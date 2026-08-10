using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32;

internal static class NativeEntrySupervisor
{
    private const uint EventObjectShow = 0x8002;
    private const uint WineventOutOfContext = 0x0000;
    private const uint WineventSkipOwnProcess = 0x0002;
    private const int ObjectIdWindow = 0;
    private const uint ProcessQueryLimitedInformation = 0x1000;
    private const uint WmClose = 0x0010;
    private const uint WmQuit = 0x0012;
    private const uint PmNoRemove = 0x0000;
    private const int NewProcessMaximumAgeMs = 20000;
    private const int NativeCloseGraceMs = 600;
    private const int NativeKillSettleMs = 1200;
    private const int RestartWindowMinutes = 10;
    private const int RestartLimit = 3;
    private const string StopEventName = @"Local\WukongCodexForge.NativeEntrySupervisor.Stop";
    private const string ReadyEventName = @"Local\WukongCodexForge.NativeEntrySupervisor.Ready";
    private const string ManagedLaunchEventName = @"Local\WukongCodexForge.NativeEntrySupervisor.ManagedLaunch";
    private const string InstanceMutexName = @"Local\WukongCodexForge.NativeEntrySupervisor.Instance";
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";

    private static readonly object StateLock = new object();
    private static readonly object LogLock = new object();
    private static readonly HashSet<string> ObservedProcesses = new HashSet<string>(StringComparer.Ordinal);
    private static readonly Queue<DateTime> RestartHistory = new Queue<DateTime>();
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

    private static string repositoryRoot;
    private static string markerPath;
    private static string expectedChatGptPath;
    private static string embeddedNodePath;
    private static string bridgePath;
    private static string profilePath;
    private static string runValueName;
    private static string eventLogPath;
    private static EventWaitHandle stopEvent;
    private static EventWaitHandle readyEvent;
    private static EventWaitHandle managedLaunchEvent;
    private static Mutex instanceMutex;
    private static FileSystemWatcher repositoryWatcher;
    private static RegisteredWaitHandle stopRegistration;
    private static NativeMethods.WinEventDelegate winEventDelegate;
    private static IntPtr winEventHook = IntPtr.Zero;
    private static uint mainThreadId;
    private static int shuttingDown;
    private static int markerValidationQueued;
    private static int launchHandlerActive;
    private static DateTime armedAtUtc = DateTime.MaxValue;
    private static DateTime managedRelaunchSuppressedUntilUtc = DateTime.MinValue;

    private sealed class LaunchObservation
    {
        internal int ProcessId;
        internal DateTime StartTimeUtc;
        internal int AgeAtEventMs;
        internal bool ManagedLaunchSignaled;
    }

    private static int Main(string[] args)
    {
        bool ownsMutex = false;
        try
        {
            IDictionary<string, string> options = ParseArguments(args);
            repositoryRoot = CanonicalPath(Required(options, "repo"));
            markerPath = Path.Combine(repositoryRoot, "package.json");
            expectedChatGptPath = CanonicalPath(Required(options, "chatgpt"));
            embeddedNodePath = CanonicalPath(Required(options, "node"));
            bridgePath = CanonicalPath(Required(options, "bridge"));
            profilePath = CanonicalPath(Required(options, "profile"));
            runValueName = Required(options, "run-value");

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string stateDirectory = Path.Combine(localAppData, "WukongCodexForge", "native-supervisor");
            Directory.CreateDirectory(stateDirectory);
            eventLogPath = Path.Combine(stateDirectory, "events.jsonl");

            if (!ValidateInputs())
            {
                RemoveRunValue();
                return 2;
            }

            bool createdNew;
            instanceMutex = new Mutex(true, InstanceMutexName, out createdNew);
            if (!createdNew)
            {
                return 0;
            }
            ownsMutex = true;

            bool stopCreated;
            stopEvent = new EventWaitHandle(false, EventResetMode.ManualReset, StopEventName, out stopCreated);
            stopEvent.Reset();
            bool readyCreated;
            readyEvent = new EventWaitHandle(false, EventResetMode.ManualReset, ReadyEventName, out readyCreated);
            readyEvent.Reset();
            bool managedLaunchCreated;
            managedLaunchEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ManagedLaunchEventName, out managedLaunchCreated);

            mainThreadId = NativeMethods.GetCurrentThreadId();
            NativeMethods.Message ignored;
            NativeMethods.PeekMessage(out ignored, IntPtr.Zero, 0, 0, PmNoRemove);
            stopRegistration = ThreadPool.RegisterWaitForSingleObject(
                stopEvent,
                delegate { RequestShutdown(false, "stop-event"); },
                null,
                Timeout.Infinite,
                true);

            repositoryWatcher = new FileSystemWatcher(repositoryRoot, "package.json");
            repositoryWatcher.NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite;
            repositoryWatcher.Deleted += delegate { QueueMarkerValidation("repository-marker-deleted"); };
            repositoryWatcher.Renamed += delegate(object sender, RenamedEventArgs eventArgs)
            {
                if (String.Equals(CanonicalPath(eventArgs.OldFullPath), markerPath, StringComparison.OrdinalIgnoreCase))
                {
                    QueueMarkerValidation("repository-marker-renamed");
                }
            };
            repositoryWatcher.Error += delegate(object sender, ErrorEventArgs eventArgs)
            {
                Log("repository-watcher-error", null, eventArgs.GetException());
                QueueMarkerValidation("repository-watcher-error");
            };
            repositoryWatcher.EnableRaisingEvents = true;

            winEventDelegate = OnWinEvent;
            winEventHook = NativeMethods.SetWinEventHook(
                EventObjectShow,
                EventObjectShow,
                IntPtr.Zero,
                winEventDelegate,
                0,
                0,
                WineventOutOfContext | WineventSkipOwnProcess);
            if (winEventHook == IntPtr.Zero)
            {
                throw new InvalidOperationException("SetWinEventHook(EVENT_OBJECT_SHOW) failed.");
            }
            armedAtUtc = DateTime.UtcNow;

            Log("supervisor-ready", Fields("chatGptPath", expectedChatGptPath), null);
            readyEvent.Set();
            RunMessageLoop();
            return 0;
        }
        catch (Exception error)
        {
            Log("supervisor-failed", null, error);
            return 1;
        }
        finally
        {
            Interlocked.Exchange(ref shuttingDown, 1);
            if (winEventHook != IntPtr.Zero)
            {
                NativeMethods.UnhookWinEvent(winEventHook);
                winEventHook = IntPtr.Zero;
            }
            if (repositoryWatcher != null)
            {
                repositoryWatcher.EnableRaisingEvents = false;
                repositoryWatcher.Dispose();
            }
            if (stopRegistration != null)
            {
                stopRegistration.Unregister(null);
            }
            if (stopEvent != null)
            {
                stopEvent.Dispose();
            }
            if (readyEvent != null)
            {
                readyEvent.Dispose();
            }
            if (managedLaunchEvent != null)
            {
                managedLaunchEvent.Dispose();
            }
            if (ownsMutex && instanceMutex != null)
            {
                try { instanceMutex.ReleaseMutex(); }
                catch (ApplicationException) { }
            }
            if (instanceMutex != null)
            {
                instanceMutex.Dispose();
            }
        }
    }

    private static void RunMessageLoop()
    {
        NativeMethods.Message message;
        while (true)
        {
            int result = NativeMethods.GetMessage(out message, IntPtr.Zero, 0, 0);
            if (result == 0)
            {
                return;
            }
            if (result < 0)
            {
                throw new InvalidOperationException("The native supervisor message loop failed.");
            }
            NativeMethods.TranslateMessage(ref message);
            NativeMethods.DispatchMessage(ref message);
        }
    }

    private static void OnWinEvent(
        IntPtr hook,
        uint eventType,
        IntPtr window,
        int objectId,
        int childId,
        uint eventThread,
        uint eventTime)
    {
        if (Volatile.Read(ref shuttingDown) != 0 || window == IntPtr.Zero || objectId != ObjectIdWindow)
        {
            return;
        }

        uint unsignedProcessId;
        NativeMethods.GetWindowThreadProcessId(window, out unsignedProcessId);
        if (unsignedProcessId == 0 || unsignedProcessId > Int32.MaxValue)
        {
            return;
        }
        int processId = (int)unsignedProcessId;
        if (!IsExpectedOfficialProcess(processId))
        {
            return;
        }

        DateTime startTimeUtc;
        try
        {
            using (Process process = Process.GetProcessById(processId))
            {
                startTimeUtc = process.StartTime.ToUniversalTime();
            }
        }
        catch
        {
            return;
        }

        // A newly installed supervisor must never reinterpret a window that was
        // already running as a launch request. Only processes created after the
        // event hook became active are eligible for the bounded repair path.
        if (startTimeUtc < armedAtUtc)
        {
            return;
        }

        int ageAtEventMs = (int)Math.Max(0, Math.Min(Int32.MaxValue, (DateTime.UtcNow - startTimeUtc).TotalMilliseconds));
        string observationKey = processId.ToString(CultureInfo.InvariantCulture) + ":" + startTimeUtc.Ticks.ToString(CultureInfo.InvariantCulture);
        lock (StateLock)
        {
            if (!ObservedProcesses.Add(observationKey))
            {
                return;
            }
        }

        bool managedLaunchSignaled = managedLaunchEvent != null && managedLaunchEvent.WaitOne(0);
        if (managedLaunchSignaled)
        {
            DateTime requestedSuppression = DateTime.UtcNow.AddSeconds(45);
            lock (StateLock)
            {
                if (managedRelaunchSuppressedUntilUtc < requestedSuppression)
                {
                    managedRelaunchSuppressedUntilUtc = requestedSuppression;
                }
            }
        }

        LaunchObservation observation = new LaunchObservation();
        observation.ProcessId = processId;
        observation.StartTimeUtc = startTimeUtc;
        observation.AgeAtEventMs = ageAtEventMs;
        observation.ManagedLaunchSignaled = managedLaunchSignaled;
        ThreadPool.QueueUserWorkItem(
            delegate
            {
                if (Interlocked.CompareExchange(ref launchHandlerActive, 1, 0) != 0)
                {
                    Log("official-launch-coalesced", Fields("processId", observation.ProcessId), null);
                    return;
                }
                try { HandleOfficialLaunch(observation); }
                catch (Exception error) { Log("official-launch-handler-failed", Fields("processId", observation.ProcessId), error); }
                finally { Interlocked.Exchange(ref launchHandlerActive, 0); }
            });
    }

    private static void HandleOfficialLaunch(LaunchObservation observation)
    {
        if (Volatile.Read(ref shuttingDown) != 0)
        {
            return;
        }
        if (observation.ManagedLaunchSignaled)
        {
            Log("managed-launch-signal-consumed", Fields("processId", observation.ProcessId), null);
        }
        DateTime suppressionDeadline;
        lock (StateLock)
        {
            suppressionDeadline = managedRelaunchSuppressedUntilUtc;
        }
        if (DateTime.UtcNow < suppressionDeadline)
        {
            Dictionary<string, object> suppression = Fields("processId", observation.ProcessId);
            suppression["suppressedUntil"] = suppressionDeadline.ToString("o", CultureInfo.InvariantCulture);
            Log("managed-relaunch-restart-suppressed", suppression, null);
            return;
        }

        Dictionary<string, object> details = Fields("processId", observation.ProcessId);
        details["ageAtEventMs"] = observation.AgeAtEventMs;
        Log("official-window-observed", details, null);

        if (HasCodexCdp())
        {
            lock (StateLock)
            {
                managedRelaunchSuppressedUntilUtc = DateTime.MinValue;
            }
            Log("managed-channel-confirmed", Fields("processId", observation.ProcessId), null);
            return;
        }
        if (Volatile.Read(ref shuttingDown) != 0)
        {
            return;
        }

        if (observation.AgeAtEventMs > NewProcessMaximumAgeMs)
        {
            Log("existing-native-window-ignored", Fields("processId", observation.ProcessId), null);
            return;
        }
        if (!File.Exists(markerPath))
        {
            RequestShutdown(true, "repository-marker-missing");
            return;
        }
        if (!TryConsumeRestartBudget())
        {
            Log("restart-circuit-open", Fields("processId", observation.ProcessId), null);
            return;
        }

        Log("native-restart-requested", Fields("processId", observation.ProcessId), null);
        if (!StopOfficialProcesses())
        {
            Log("native-restart-blocked", Fields("reason", "official-process-remained"), null);
            return;
        }
        if (Volatile.Read(ref shuttingDown) != 0 || !ValidateInputs())
        {
            return;
        }

        lock (StateLock)
        {
            // The repository host has its own 45-second bounded channel wait.
            // Never restart the official process created by this bridge while
            // that first managed launch is still settling.
            managedRelaunchSuppressedUntilUtc = DateTime.UtcNow.AddSeconds(45);
        }
        try
        {
            ProcessStartInfo launch = new ProcessStartInfo();
            launch.FileName = embeddedNodePath;
            launch.Arguments = QuoteWindowsArgument(bridgePath);
            launch.WorkingDirectory = repositoryRoot;
            launch.UseShellExecute = false;
            launch.CreateNoWindow = true;
            launch.WindowStyle = ProcessWindowStyle.Hidden;
            Process bridge = Process.Start(launch);
            int bridgeProcessId = bridge == null ? 0 : bridge.Id;
            if (bridge != null)
            {
                bridge.Dispose();
            }
            Log("managed-bridge-started", Fields("bridgeProcessId", bridgeProcessId), null);
        }
        catch
        {
            lock (StateLock)
            {
                managedRelaunchSuppressedUntilUtc = DateTime.MinValue;
            }
            throw;
        }
    }

    private static bool HasCodexCdp()
    {
        try
        {
            string activePortPath = Path.Combine(profilePath, "DevToolsActivePort");
            if (!File.Exists(activePortPath))
            {
                return false;
            }
            string[] lines = File.ReadAllLines(activePortPath, Encoding.UTF8);
            int port;
            if (lines.Length == 0 || !Int32.TryParse(lines[0], NumberStyles.None, CultureInfo.InvariantCulture, out port))
            {
                return false;
            }
            if (port < 1024 || port > 65535)
            {
                return false;
            }

            string endpoint = "http://127.0.0.1:" + port.ToString(CultureInfo.InvariantCulture);
            string versionJson = ReadLocalJson(endpoint + "/json/version");
            string targetsJson = ReadLocalJson(endpoint + "/json/list");
            if (String.IsNullOrEmpty(versionJson) || String.IsNullOrEmpty(targetsJson))
            {
                return false;
            }

            object decoded = Json.DeserializeObject(targetsJson);
            object[] targets = decoded as object[];
            if (targets == null)
            {
                return false;
            }
            foreach (object item in targets)
            {
                IDictionary<string, object> target = item as IDictionary<string, object>;
                if (target == null)
                {
                    continue;
                }
                object typeValue;
                object urlValue;
                if (!target.TryGetValue("type", out typeValue) || !target.TryGetValue("url", out urlValue))
                {
                    continue;
                }
                string type = Convert.ToString(typeValue, CultureInfo.InvariantCulture);
                string url = Convert.ToString(urlValue, CultureInfo.InvariantCulture);
                string decodedUrl = Uri.UnescapeDataString(url ?? String.Empty);
                bool isMainCodex =
                    String.Equals(type, "page", StringComparison.Ordinal) &&
                    (decodedUrl.StartsWith("app://codex/", StringComparison.OrdinalIgnoreCase) ||
                     decodedUrl.StartsWith("app://-/index.html", StringComparison.OrdinalIgnoreCase)) &&
                    decodedUrl.IndexOf("initialRoute=/avatar-overlay", StringComparison.OrdinalIgnoreCase) < 0;
                if (isMainCodex)
                {
                    return true;
                }
            }
        }
        catch
        {
        }
        return false;
    }

    private static string ReadLocalJson(string uri)
    {
        HttpWebRequest request = (HttpWebRequest)WebRequest.Create(uri);
        request.Proxy = null;
        request.KeepAlive = false;
        request.Timeout = 700;
        request.ReadWriteTimeout = 700;
        request.Method = "GET";
        using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
        {
            if (response.StatusCode != HttpStatusCode.OK)
            {
                return null;
            }
            using (Stream stream = response.GetResponseStream())
            using (StreamReader reader = new StreamReader(stream, Encoding.UTF8, true, 4096))
            {
                return reader.ReadToEnd();
            }
        }
    }

    private static bool TryConsumeRestartBudget()
    {
        DateTime now = DateTime.UtcNow;
        DateTime cutoff = now.AddMinutes(-RestartWindowMinutes);
        lock (StateLock)
        {
            while (RestartHistory.Count > 0 && RestartHistory.Peek() < cutoff)
            {
                RestartHistory.Dequeue();
            }
            if (RestartHistory.Count >= RestartLimit)
            {
                return false;
            }
            RestartHistory.Enqueue(now);
            return true;
        }
    }

    private static bool StopOfficialProcesses()
    {
        IList<int> processIds = GetOfficialProcessIds();
        if (processIds.Count == 0)
        {
            return true;
        }

        HashSet<int> expectedIds = new HashSet<int>(processIds);
        NativeMethods.EnumWindows(
            delegate(IntPtr window, IntPtr parameter)
            {
                uint unsignedProcessId;
                NativeMethods.GetWindowThreadProcessId(window, out unsignedProcessId);
                if (unsignedProcessId <= Int32.MaxValue && expectedIds.Contains((int)unsignedProcessId))
                {
                    NativeMethods.PostMessage(window, WmClose, IntPtr.Zero, IntPtr.Zero);
                }
                return true;
            },
            IntPtr.Zero);

        if (WaitUntilNoOfficialProcesses(NativeCloseGraceMs))
        {
            return true;
        }

        foreach (int processId in GetOfficialProcessIds())
        {
            if (!IsExpectedOfficialProcess(processId))
            {
                continue;
            }
            try
            {
                using (Process process = Process.GetProcessById(processId))
                {
                    if (!process.HasExited && IsExpectedOfficialProcess(processId))
                    {
                        process.Kill();
                    }
                }
            }
            catch (ArgumentException)
            {
            }
            catch (InvalidOperationException)
            {
            }
            catch (System.ComponentModel.Win32Exception error)
            {
                Log("official-process-stop-failed", Fields("processId", processId), error);
            }
        }
        return WaitUntilNoOfficialProcesses(NativeKillSettleMs);
    }

    private static bool WaitUntilNoOfficialProcesses(int timeoutMs)
    {
        Stopwatch timer = Stopwatch.StartNew();
        while (timer.ElapsedMilliseconds < timeoutMs)
        {
            if (GetOfficialProcessIds().Count == 0)
            {
                return true;
            }
            if (stopEvent != null && stopEvent.WaitOne(100))
            {
                return false;
            }
        }
        return GetOfficialProcessIds().Count == 0;
    }

    private static IList<int> GetOfficialProcessIds()
    {
        List<int> result = new List<int>();
        Process[] processes;
        try { processes = Process.GetProcessesByName("ChatGPT"); }
        catch { return result; }
        foreach (Process process in processes)
        {
            using (process)
            {
                try
                {
                    if (IsExpectedOfficialProcess(process.Id))
                    {
                        result.Add(process.Id);
                    }
                }
                catch
                {
                }
            }
        }
        return result;
    }

    private static bool IsExpectedOfficialProcess(int processId)
    {
        string actualPath = QueryProcessImagePath(processId);
        return !String.IsNullOrEmpty(actualPath) &&
            String.Equals(CanonicalPath(actualPath), expectedChatGptPath, StringComparison.OrdinalIgnoreCase);
    }

    private static string QueryProcessImagePath(int processId)
    {
        IntPtr process = NativeMethods.OpenProcess(ProcessQueryLimitedInformation, false, processId);
        if (process == IntPtr.Zero)
        {
            return null;
        }
        try
        {
            uint capacity = 32768;
            StringBuilder path = new StringBuilder((int)capacity);
            if (!NativeMethods.QueryFullProcessImageName(process, 0, path, ref capacity))
            {
                return null;
            }
            return path.ToString();
        }
        finally
        {
            NativeMethods.CloseHandle(process);
        }
    }

    private static bool ValidateInputs()
    {
        try
        {
            if (!ValidateRepositoryMarker())
            {
                return false;
            }
            return File.Exists(expectedChatGptPath) &&
                File.Exists(embeddedNodePath) &&
                File.Exists(bridgePath) &&
                Directory.Exists(profilePath) &&
                IsDirectPath(repositoryRoot) &&
                IsDirectPath(expectedChatGptPath) &&
                IsDirectPath(embeddedNodePath) &&
                IsDirectPath(bridgePath);
        }
        catch
        {
            return false;
        }
    }

    private static bool ValidateRepositoryMarker()
    {
        if (!File.Exists(markerPath))
        {
            return false;
        }
        string text = File.ReadAllText(markerPath, Encoding.UTF8);
        object decoded = Json.DeserializeObject(text);
        IDictionary<string, object> marker = decoded as IDictionary<string, object>;
        object name;
        return marker != null && marker.TryGetValue("name", out name) &&
            String.Equals(Convert.ToString(name, CultureInfo.InvariantCulture), "wukong-codex-theme", StringComparison.Ordinal);
    }

    private static bool IsDirectPath(string value)
    {
        string fullPath = CanonicalPath(value);
        string root = Path.GetPathRoot(fullPath);
        string relative = fullPath.Substring(root.Length);
        string cursor = root;
        string[] segments = relative.Split(new char[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
        foreach (string segment in segments)
        {
            cursor = Path.Combine(cursor, segment);
            if (!File.Exists(cursor) && !Directory.Exists(cursor))
            {
                return false;
            }
            FileAttributes attributes = File.GetAttributes(cursor);
            if ((attributes & FileAttributes.ReparsePoint) != 0)
            {
                return false;
            }
        }
        return true;
    }

    private static void RequestShutdown(bool removeRunValue, string reason)
    {
        if (Interlocked.Exchange(ref shuttingDown, 1) != 0)
        {
            return;
        }
        if (removeRunValue)
        {
            RemoveRunValue();
        }
        Log("supervisor-stopping", Fields("reason", reason), null);
        if (mainThreadId != 0)
        {
            NativeMethods.PostThreadMessage(mainThreadId, WmQuit, IntPtr.Zero, IntPtr.Zero);
        }
    }

    private static void QueueMarkerValidation(string reason)
    {
        if (Interlocked.CompareExchange(ref markerValidationQueued, 1, 0) != 0)
        {
            return;
        }
        ThreadPool.QueueUserWorkItem(
            delegate
            {
                try
                {
                    // Editors commonly save package.json through a short rename.
                    // One event-bounded grace period avoids treating that as a
                    // repository deletion; this is not a steady-state poll.
                    if (stopEvent != null && stopEvent.WaitOne(750))
                    {
                        return;
                    }
                    bool markerValid = false;
                    try
                    {
                        markerValid = ValidateRepositoryMarker();
                    }
                    catch (Exception error)
                    {
                        Log("repository-marker-validation-failed", Fields("reason", reason), error);
                    }
                    if (!markerValid)
                    {
                        RequestShutdown(true, reason);
                    }
                }
                finally
                {
                    Interlocked.Exchange(ref markerValidationQueued, 0);
                }
            });
    }

    private static void RemoveRunValue()
    {
        if (String.IsNullOrEmpty(runValueName))
        {
            return;
        }
        try
        {
            using (RegistryKey runKey = Registry.CurrentUser.OpenSubKey(RunKeyPath, true))
            {
                if (runKey != null)
                {
                    runKey.DeleteValue(runValueName, false);
                }
            }
        }
        catch (Exception error)
        {
            Log("run-value-remove-failed", Fields("runValue", runValueName), error);
        }
    }

    private static IDictionary<string, string> ParseArguments(string[] args)
    {
        Dictionary<string, string> values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (int index = 0; index < args.Length; index += 2)
        {
            if (index + 1 >= args.Length || !args[index].StartsWith("--", StringComparison.Ordinal))
            {
                throw new ArgumentException("Native supervisor arguments must be --name value pairs.");
            }
            values[args[index].Substring(2)] = args[index + 1];
        }
        return values;
    }

    private static string Required(IDictionary<string, string> options, string name)
    {
        string value;
        if (!options.TryGetValue(name, out value) || String.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Missing required --" + name + " argument.");
        }
        return value;
    }

    private static string CanonicalPath(string value)
    {
        return Path.GetFullPath(value).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    }

    private static string QuoteWindowsArgument(string value)
    {
        StringBuilder result = new StringBuilder(value.Length + 2);
        result.Append('\"');
        int backslashes = 0;
        foreach (char character in value)
        {
            if (character == '\\')
            {
                backslashes += 1;
                continue;
            }
            if (character == '\"')
            {
                result.Append('\\', backslashes * 2 + 1);
                result.Append('\"');
                backslashes = 0;
                continue;
            }
            if (backslashes > 0)
            {
                result.Append('\\', backslashes);
                backslashes = 0;
            }
            result.Append(character);
        }
        result.Append('\\', backslashes * 2);
        result.Append('\"');
        return result.ToString();
    }

    private static Dictionary<string, object> Fields(string name, object value)
    {
        Dictionary<string, object> fields = new Dictionary<string, object>();
        fields[name] = value;
        return fields;
    }

    private static void Log(string state, IDictionary<string, object> fields, Exception error)
    {
        try
        {
            Dictionary<string, object> entry = new Dictionary<string, object>();
            entry["at"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
            entry["state"] = state;
            entry["supervisorPid"] = Process.GetCurrentProcess().Id;
            if (fields != null)
            {
                foreach (KeyValuePair<string, object> field in fields)
                {
                    entry[field.Key] = field.Value;
                }
            }
            if (error != null)
            {
                entry["errorType"] = error.GetType().FullName;
                entry["error"] = error.Message;
            }
            if (!String.IsNullOrEmpty(eventLogPath))
            {
                string line = Json.Serialize(entry) + Environment.NewLine;
                lock (LogLock)
                {
                    File.AppendAllText(eventLogPath, line, new UTF8Encoding(false));
                }
            }
        }
        catch
        {
        }
    }

    private static class NativeMethods
    {
        [StructLayout(LayoutKind.Sequential)]
        internal struct Point
        {
            internal int X;
            internal int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct Message
        {
            internal IntPtr Window;
            internal uint Value;
            internal IntPtr WParam;
            internal IntPtr LParam;
            internal uint Time;
            internal Point Cursor;
            internal uint Private;
        }

        internal delegate void WinEventDelegate(
            IntPtr hook,
            uint eventType,
            IntPtr window,
            int objectId,
            int childId,
            uint eventThread,
            uint eventTime);

        internal delegate bool EnumWindowsDelegate(IntPtr window, IntPtr parameter);

        [DllImport("user32.dll")]
        internal static extern IntPtr SetWinEventHook(
            uint eventMinimum,
            uint eventMaximum,
            IntPtr eventHookModule,
            WinEventDelegate callback,
            uint processId,
            uint threadId,
            uint flags);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool UnhookWinEvent(IntPtr hook);

        [DllImport("user32.dll")]
        internal static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool EnumWindows(EnumWindowsDelegate callback, IntPtr parameter);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool PostThreadMessage(uint threadId, uint message, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        internal static extern int GetMessage(out Message message, IntPtr window, uint filterMinimum, uint filterMaximum);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool PeekMessage(out Message message, IntPtr window, uint filterMinimum, uint filterMaximum, uint removeMessage);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool TranslateMessage(ref Message message);

        [DllImport("user32.dll")]
        internal static extern IntPtr DispatchMessage(ref Message message);

        [DllImport("kernel32.dll")]
        internal static extern uint GetCurrentThreadId();

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr OpenProcess(uint desiredAccess, bool inheritHandle, int processId);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder path, ref uint size);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool CloseHandle(IntPtr handle);
    }
}
