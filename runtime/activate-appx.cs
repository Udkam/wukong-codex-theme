using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Text;
using System.Threading;

namespace WukongCodexForge
{
    internal static class ActivateAppxProgram
    {
        private const string ManagedLaunchEventName =
            @"Local\WukongCodexForge.NativeEntrySupervisor.ManagedLaunch";

        private sealed class Options
        {
            internal string Aumid;
            internal string ExpectedExecutable;
            internal string Package;
            internal string Version;
            internal string ArgumentLine;
        }

        [Flags]
        private enum ActivateOptions
        {
            None = 0x00000000,
            DesignMode = 0x00000001,
            NoErrorUI = 0x00000002,
            NoSplashScreen = 0x00000004
        }

        [ComImport]
        [Guid("2E941141-7F97-4756-BA1D-9DECDE894A3D")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IApplicationActivationManager
        {
            [PreserveSig]
            int ActivateApplication(
                [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
                [MarshalAs(UnmanagedType.LPWStr)] string arguments,
                ActivateOptions options,
                out uint processId);
        }

        [ComImport]
        [Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
        private class ApplicationActivationManager
        {
        }

        private static int Main(string[] args)
        {
            try
            {
                Options options = ParseOptions(args);
                uint processId = ActivateWithSupervisorMarker(options.Aumid, options.ArgumentLine);
                Console.OutputEncoding = new UTF8Encoding(false);
                Console.Out.WriteLine(BuildResultJson(processId, options));
                return 0;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine("activate-appx: " + EscapeError(error.Message));
                return 1;
            }
        }

        private static Options ParseOptions(string[] args)
        {
            if (args == null || args.Length == 0 || args.Length % 2 != 0)
            {
                throw new ArgumentException(
                    "Expected flag/value pairs for aumid, executable, package, version, and arguments.");
            }

            Dictionary<string, string> values = new Dictionary<string, string>(
                StringComparer.Ordinal);
            for (int index = 0; index < args.Length; index += 2)
            {
                string flag = args[index];
                if (!IsKnownFlag(flag))
                {
                    throw new ArgumentException("Unknown argument: " + SafeValue(flag));
                }
                if (values.ContainsKey(flag))
                {
                    throw new ArgumentException("Duplicate argument: " + flag);
                }
                values.Add(flag, args[index + 1]);
            }

            RequireFlag(values, "--aumid");
            RequireFlag(values, "--expected-executable");
            RequireFlag(values, "--package");
            RequireFlag(values, "--version");
            RequireFlag(values, "--arguments-base64");

            string aumid = RequireSingleLineValue("--aumid", values["--aumid"]);
            int separator = aumid.IndexOf('!');
            if (separator <= 0 || separator == aumid.Length - 1 ||
                separator != aumid.LastIndexOf('!'))
            {
                throw new ArgumentException("--aumid must have the form PackageFamilyName!ApplicationId.");
            }

            string package = RequireSingleLineValue("--package", values["--package"]);
            string versionText = RequireSingleLineValue("--version", values["--version"]);
            Version parsedVersion;
            if (!System.Version.TryParse(versionText, out parsedVersion))
            {
                throw new ArgumentException("--version must be a valid dotted version.");
            }

            string argumentLine = DecodeArgumentLine(values["--arguments-base64"]);
            string executable = ValidateExecutable(values["--expected-executable"]);

            Options options = new Options();
            options.Aumid = aumid;
            options.ExpectedExecutable = executable;
            options.Package = package;
            options.Version = parsedVersion.ToString();
            options.ArgumentLine = argumentLine;
            return options;
        }

        private static bool IsKnownFlag(string flag)
        {
            return String.Equals(flag, "--aumid", StringComparison.Ordinal) ||
                String.Equals(flag, "--expected-executable", StringComparison.Ordinal) ||
                String.Equals(flag, "--package", StringComparison.Ordinal) ||
                String.Equals(flag, "--version", StringComparison.Ordinal) ||
                String.Equals(flag, "--arguments-base64", StringComparison.Ordinal);
        }

        private static void RequireFlag(Dictionary<string, string> values, string flag)
        {
            if (!values.ContainsKey(flag))
            {
                throw new ArgumentException("Missing required argument: " + flag);
            }
        }

        private static string RequireSingleLineValue(string name, string value)
        {
            if (String.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException(name + " must not be empty.");
            }
            RejectLineBreakingCharacters(name, value);
            return value;
        }

        private static string ValidateExecutable(string value)
        {
            string suppliedPath = RequireSingleLineValue("--expected-executable", value);
            if (!Path.IsPathRooted(suppliedPath))
            {
                throw new ArgumentException("--expected-executable must be an absolute path.");
            }

            string fullPath = Path.GetFullPath(suppliedPath);
            if (!File.Exists(fullPath))
            {
                throw new FileNotFoundException("The expected AppX executable does not exist.", fullPath);
            }
            return fullPath;
        }

        private static string DecodeArgumentLine(string encoded)
        {
            if (encoded == null)
            {
                throw new ArgumentException("--arguments-base64 must be supplied.");
            }

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(encoded);
            }
            catch (FormatException)
            {
                throw new ArgumentException("--arguments-base64 must be canonical Base64.");
            }

            string canonical = Convert.ToBase64String(bytes);
            if (!String.Equals(canonical, encoded, StringComparison.Ordinal))
            {
                throw new ArgumentException("--arguments-base64 must be canonical Base64.");
            }

            string argumentLine;
            try
            {
                argumentLine = new UTF8Encoding(false, true).GetString(bytes);
            }
            catch (DecoderFallbackException)
            {
                throw new ArgumentException("--arguments-base64 must decode as strict UTF-8.");
            }

            RejectLineBreakingCharacters("decoded argument line", argumentLine);
            return argumentLine;
        }

        private static void RejectLineBreakingCharacters(string name, string value)
        {
            if (value.IndexOf('\0') >= 0 || value.IndexOf('\r') >= 0 || value.IndexOf('\n') >= 0)
            {
                throw new ArgumentException(name + " must not contain NUL, CR, or LF characters.");
            }
        }

        private static uint ActivateWithSupervisorMarker(string aumid, string argumentLine)
        {
            EventWaitHandle supervisorEvent = null;
            bool markerSet = false;
            try
            {
                try
                {
                    supervisorEvent = EventWaitHandle.OpenExisting(
                        ManagedLaunchEventName,
                        EventWaitHandleRights.Modify);
                }
                catch (WaitHandleCannotBeOpenedException)
                {
                    supervisorEvent = null;
                }

                if (supervisorEvent != null)
                {
                    if (!supervisorEvent.Set())
                    {
                        throw new InvalidOperationException(
                            "The managed-launch supervisor event could not be signaled.");
                    }
                    markerSet = true;
                }

                try
                {
                    return Activate(aumid, argumentLine);
                }
                catch
                {
                    if (markerSet)
                    {
                        try
                        {
                            supervisorEvent.Reset();
                        }
                        catch
                        {
                        }
                    }
                    throw;
                }
            }
            finally
            {
                if (supervisorEvent != null)
                {
                    supervisorEvent.Dispose();
                }
            }
        }

        private static uint Activate(string aumid, string argumentLine)
        {
            IApplicationActivationManager manager = null;
            try
            {
                manager = (IApplicationActivationManager)new ApplicationActivationManager();
                uint processId;
                int result = manager.ActivateApplication(
                    aumid,
                    argumentLine,
                    ActivateOptions.None,
                    out processId);
                if (result < 0)
                {
                    Marshal.ThrowExceptionForHR(result);
                }
                if (processId == 0)
                {
                    throw new InvalidOperationException(
                        "AppX activation returned an invalid process identifier.");
                }
                return processId;
            }
            finally
            {
                if (manager != null && Marshal.IsComObject(manager))
                {
                    try
                    {
                        Marshal.FinalReleaseComObject(manager);
                    }
                    catch
                    {
                    }
                }
            }
        }

        private static string BuildResultJson(uint processId, Options options)
        {
            StringBuilder json = new StringBuilder(320);
            json.Append("{\"pid\":");
            json.Append(processId.ToString(CultureInfo.InvariantCulture));
            json.Append(",\"aumid\":\"");
            json.Append(EscapeJson(options.Aumid));
            json.Append("\",\"package\":\"");
            json.Append(EscapeJson(options.Package));
            json.Append("\",\"version\":\"");
            json.Append(EscapeJson(options.Version));
            json.Append("\",\"executable\":\"");
            json.Append(EscapeJson(options.ExpectedExecutable));
            json.Append("\"}");
            return json.ToString();
        }

        private static string EscapeJson(string value)
        {
            StringBuilder escaped = new StringBuilder(value.Length + 16);
            for (int index = 0; index < value.Length; index++)
            {
                char character = value[index];
                switch (character)
                {
                    case '"': escaped.Append("\\\""); break;
                    case '\\': escaped.Append("\\\\"); break;
                    case '\b': escaped.Append("\\b"); break;
                    case '\f': escaped.Append("\\f"); break;
                    case '\n': escaped.Append("\\n"); break;
                    case '\r': escaped.Append("\\r"); break;
                    case '\t': escaped.Append("\\t"); break;
                    default:
                        if (character < 0x20 || character > 0x7e)
                        {
                            escaped.Append("\\u");
                            escaped.Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            escaped.Append(character);
                        }
                        break;
                }
            }
            return escaped.ToString();
        }

        private static string EscapeError(string value)
        {
            if (value == null)
            {
                return "Unknown failure.";
            }
            return EscapeJson(value);
        }

        private static string SafeValue(string value)
        {
            return value == null ? "<null>" : EscapeError(value);
        }
    }
}
