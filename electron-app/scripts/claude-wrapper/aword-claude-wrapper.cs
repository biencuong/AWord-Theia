// aword-claude-wrapper.exe — tệp chạy trung gian cho tùy chọn "claudeCode.claudeProcessWrapper" của
// extension Claude Code, CHỈ đặt trong tùy chọn người dùng của AWord (~/.theia/settings.json).
//
// Vì sao cần: claude.exe ưu tiên khối "env" trong ~/.claude/settings.json (dùng chung cả máy) HƠN biến
// môi trường của tiến trình, nên không thể đổi nhà cung cấp mô hình riêng cho AWord bằng biến môi
// trường. Cờ dòng lệnh --settings thì thắng settings.json chung (đã kiểm chứng trên claude.exe 2.1.211 và 2.1.270).
// Extension không cho thêm tham số, nhưng cho thay tệp chạy: nó gọi <wrapper> <đường-dẫn-claude.exe> <tham số>.
//
// Hành vi: nếu biến AWORD_CLAUDE_SETTINGS trỏ tới một tệp có thật thì chèn "--settings <tệp>" trước các
// tham số gốc; ngược lại chạy claude.exe y nguyên (không đổi gì). Truyền thẳng stdin/stdout/stderr, trả
// đúng mã thoát. Tự đưa mình vào Job Object KILL_ON_JOB_CLOSE: extension kết thúc wrapper thì claude.exe
// và mọi tiến trình con của nó cũng bị kết thúc theo, không để sót tiến trình ~250 MB chạy ngầm.
// Biên dịch: csc.exe (.NET Framework 4.x có sẵn trên Windows 10/11) — xem build-claude-wrapper.cjs.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

internal static class AwordClaudeWrapper
{
    private const uint CREATE_NO_WINDOW = 0x08000000;
    private const int STARTF_USESTDHANDLES = 0x00000100;
    private const uint INFINITE = 0xFFFFFFFF;
    private const int STD_INPUT_HANDLE = -10;
    private const int STD_OUTPUT_HANDLE = -11;
    private const int STD_ERROR_HANDLE = -12;
    private const uint HANDLE_FLAG_INHERIT = 0x00000001;
    private const int JobObjectExtendedLimitInformation = 9;
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2;
        public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess, hThread;
        public int dwProcessId, dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS
    {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessW(string lpApplicationName, StringBuilder lpCommandLine, IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes, bool bInheritHandles, uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int nStdHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetHandleInformation(IntPtr hObject, uint dwMask, uint dwFlags);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObjectW(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr hJob, int infoClass, ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION lpInfo, uint cbInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    private static int Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.Error.WriteLine("aword-claude-wrapper: thieu duong dan toi claude.exe (tham so dau tien).");
            return 2;
        }

        List<string> thamSo = new List<string>();
        string settings = Environment.GetEnvironmentVariable("AWORD_CLAUDE_SETTINGS");
        if (!string.IsNullOrEmpty(settings) && File.Exists(settings))
        {
            thamSo.Add("--settings");
            thamSo.Add(settings);
        }
        for (int i = 1; i < args.Length; i++) { thamSo.Add(args[i]); }

        GanVaoJobTuKetThuc();

        StringBuilder dongLenh = new StringBuilder(TrichDan(args[0]));
        foreach (string t in thamSo) { dongLenh.Append(' ').Append(TrichDan(t)); }

        IntPtr vao = GetStdHandle(STD_INPUT_HANDLE);
        IntPtr ra = GetStdHandle(STD_OUTPUT_HANDLE);
        IntPtr loi = GetStdHandle(STD_ERROR_HANDLE);
        ChoPhepKeThua(vao);
        ChoPhepKeThua(ra);
        ChoPhepKeThua(loi);

        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
        si.dwFlags = STARTF_USESTDHANDLES;
        si.hStdInput = vao;
        si.hStdOutput = ra;
        si.hStdError = loi;

        PROCESS_INFORMATION pi;
        if (!CreateProcessW(args[0], dongLenh, IntPtr.Zero, IntPtr.Zero, true, CREATE_NO_WINDOW, IntPtr.Zero, null, ref si, out pi))
        {
            Console.Error.WriteLine("aword-claude-wrapper: khong chay duoc " + args[0] + ": " + new Win32Exception(Marshal.GetLastWin32Error()).Message);
            return 127;
        }
        CloseHandle(pi.hThread);
        WaitForSingleObject(pi.hProcess, INFINITE);
        uint maThoat;
        if (!GetExitCodeProcess(pi.hProcess, out maThoat)) { maThoat = 1; }
        CloseHandle(pi.hProcess);
        return unchecked((int)maThoat);
    }

    // Handle stdio nhận từ tiến trình cha (pipe của Node) có thể bằng 0 hoặc -1 khi không có — bỏ qua.
    private static void ChoPhepKeThua(IntPtr h)
    {
        if (h != IntPtr.Zero && h != new IntPtr(-1)) { SetHandleInformation(h, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT); }
    }

    // Không tạo được job (hiếm) thì vẫn chạy tiếp — chỉ mất tính năng dọn tiến trình con khi bị kết thúc cưỡng bức.
    // Handle job cố ý không đóng: nó chỉ đóng khi wrapper thoát, lúc đó Windows kết thúc mọi tiến trình trong job.
    private static void GanVaoJobTuKetThuc()
    {
        IntPtr job = CreateJobObjectW(IntPtr.Zero, null);
        if (job == IntPtr.Zero) { return; }
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        uint kichThuoc = (uint)Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
        if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, ref info, kichThuoc)) { CloseHandle(job); return; }
        if (!AssignProcessToJobObject(job, GetCurrentProcess())) { CloseHandle(job); }
    }

    // Trích dẫn một tham số theo đúng quy tắc CommandLineToArgvW (giống cách Node/libuv dựng dòng lệnh).
    private static string TrichDan(string a)
    {
        if (a.Length > 0 && a.IndexOfAny(new char[] { ' ', '\t', '\n', '\v', '"' }) < 0) { return a; }
        StringBuilder sb = new StringBuilder();
        sb.Append('"');
        int i = 0;
        while (true)
        {
            int soGachNguoc = 0;
            while (i < a.Length && a[i] == '\\') { soGachNguoc++; i++; }
            if (i == a.Length)
            {
                sb.Append('\\', soGachNguoc * 2);
                break;
            }
            if (a[i] == '"')
            {
                sb.Append('\\', soGachNguoc * 2 + 1);
                sb.Append('"');
            }
            else
            {
                sb.Append('\\', soGachNguoc);
                sb.Append(a[i]);
            }
            i++;
        }
        sb.Append('"');
        return sb.ToString();
    }
}
