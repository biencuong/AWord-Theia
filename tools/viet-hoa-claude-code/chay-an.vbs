' Chay viet-hoa.cjs NGAM (khong hien cua so) - Task Scheduler goi tep nay luc dang nhap va moi gio.
' Uu tien Node.js tren may; khong co thi muon AWord Pro/AWord lam Node (ELECTRON_RUN_AS_NODE=1).
Option Explicit
Dim sh, fso, thuMuc, tepJs, local, lenh, ungDung, i
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
thuMuc = fso.GetParentFolderName(WScript.ScriptFullName)
tepJs = """" & thuMuc & "\viet-hoa.cjs"""
local = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%")

If sh.Run("cmd /c where node >nul 2>nul", 0, True) = 0 Then
    lenh = "cmd /c node " & tepJs
Else
    ungDung = Array(local & "\Programs\AWordPro\AWordPro.exe", local & "\Programs\AWord\AWord.exe")
    For i = 0 To UBound(ungDung)
        If fso.FileExists(ungDung(i)) Then
            sh.Environment("Process")("ELECTRON_RUN_AS_NODE") = "1"
            lenh = """" & ungDung(i) & """ " & tepJs
            Exit For
        End If
    Next
End If

If lenh <> "" Then sh.Run lenh, 0, True
