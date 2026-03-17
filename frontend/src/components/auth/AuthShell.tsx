/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./auth.module.css";
import { apiLogin, apiRegister } from "@/lib/authApi";

/**
 * AuthShell (Login/Signup)
 * - ธีมขาว-ส้ม
 * - สมัคร: studentCode ต้องเป็นเลข 13 หลัก (required)
 * - password >= 8, confirm ต้องตรง
 * - login fail: ข้อความรวม ๆ
 * - login success: ไป /dashboard
 */

type Mode = "login" | "signup";

export default function AuthShell({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);

  const [studentCode, setStudentCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSignup = mode === "signup";

  // รับเฉพาะตัวเลข + จำกัด 13 หลัก
  function onStudentCodeChange(v: string) {
    setStudentCode(v.replace(/\D/g, "").slice(0, 13));
  }

  const studentCodeValid = useMemo(() => {
    if (!isSignup) return studentCode.trim().length > 0;
    return /^\d{13}$/.test(studentCode);
  }, [studentCode, isSignup]);

  const passwordValid = useMemo(() => password.length >= 8, [password]);

  const confirmValid = useMemo(() => {
    if (!isSignup) return true;
    return confirmPassword.length > 0 && confirmPassword === password;
  }, [confirmPassword, password, isSignup]);

  const canSubmit = useMemo(() => {
    if (isSignup) {
      return Boolean(
        studentCodeValid &&
          firstName.trim() &&
          lastName.trim() &&
          passwordValid &&
          confirmValid &&
          !submitting
      );
    }
    return Boolean(studentCode.trim() && password && !submitting);
  }, [isSignup, studentCodeValid, firstName, lastName, passwordValid, confirmValid, studentCode, password, submitting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    try {
      setSubmitting(true);

      if (isSignup) {
        if (!studentCodeValid) throw new Error("รหัสนักศึกษาต้องเป็นตัวเลข 13 หลัก");
        if (!firstName.trim()) throw new Error("กรุณากรอกชื่อ");
        if (!lastName.trim()) throw new Error("กรุณากรอกนามสกุล");
        if (!passwordValid) throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        if (!confirmValid) throw new Error("รหัสผ่านและยืนยันรหัสผ่านต้องตรงกัน");

        await apiRegister({
          studentCode,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
          confirmPassword,
        });

        // สมัครเสร็จให้ไปหน้า login
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setErrorMsg(null);
        return;
      }

      // login
      await apiLogin({ studentCode, password });
      router.push("/dashboard");
    } catch (err: any) {
      if (!isSignup) {
        setErrorMsg("รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง");
      } else {
        setErrorMsg(err?.message || "ลงทะเบียนไม่สำเร็จ");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.left}>
          <div className={styles.badge}>StudyPlan</div>
          <h1 className={styles.title}>
            ยินดีต้อนรับสู่
            <br />
            ระบบจัดแผนการเรียน
          </h1>
          <p className={styles.subtitle}>
            ลงทะเบียนเพื่อเริ่มจัดแผนการเรียน ตรวจสอบเงื่อนไข และติดตามความคืบหน้าได้ทันที
          </p>

          {mode === "login" ? (
            <button className={styles.cta} type="button" onClick={() => { setMode("signup"); setErrorMsg(null); }}>
              ลงทะเบียน
            </button>
          ) : (
            <button className={styles.cta} type="button" onClick={() => { setMode("login"); setErrorMsg(null); }}>
              เข้าสู่ระบบ
            </button>
          )}
        </div>

        <div className={styles.right}>
          <h2 className={styles.formTitle}>{mode === "login" ? "เข้าสู่ระบบ" : "ลงทะเบียน"}</h2>

          <form onSubmit={onSubmit}>
            <label className={styles.label}>รหัสนักศึกษา (Student Code)</label>
            <input
              className={styles.input}
              value={studentCode}
              onChange={(e) => onStudentCodeChange(e.target.value)}
              inputMode="numeric"
              maxLength={13}
              placeholder="กรอกรหัสนักศึกษา 13 หลัก"
              required
            />
            {isSignup && (
              <div className={styles.hint}>{studentCodeValid ? "✓ รูปแบบถูกต้อง" : "ต้องเป็นตัวเลข 13 หลัก"}</div>
            )}

            {isSignup && (
              <div className={styles.row} style={{ marginTop: 12 }}>
                <div>
                  <label className={styles.label}>
                    ชื่อ (First name) <span style={{ color: "#ea580c" }}>*</span>
                  </label>
                  <input className={styles.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div>
                  <label className={styles.label}>
                    นามสกุล (Last name) <span style={{ color: "#ea580c" }}>*</span>
                  </label>
                  <input className={styles.input} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <label className={styles.label}>
                รหัสผ่าน (Password) <span style={{ color: "#ea580c" }}>*</span>
              </label>
              <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {isSignup && <div className={styles.hint}>{passwordValid ? "✓ อย่างน้อย 8 ตัวอักษร" : "ต้องมีอย่างน้อย 8 ตัวอักษร"}</div>}
            </div>

            {isSignup && (
              <div style={{ marginTop: 12 }}>
                <label className={styles.label}>ยืนยันรหัสผ่าน (Confirm Password)</label>
                <input
                  className={styles.input}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <div className={styles.hint}>{confirmValid ? "✓ ตรงกัน" : "ต้องตรงกับรหัสผ่าน"}</div>
              </div>
            )}

            <button className={styles.button} type="submit" disabled={!canSubmit}>
              {submitting ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : "ลงทะเบียน"}
            </button>

            <div className={styles.linkRow}>
              {mode === "login" ? (
                <>
                  ยังไม่มีบัญชี?{" "}
                  <span className={styles.link} onClick={() => { setMode("signup"); setErrorMsg(null); }}>
                    ลงทะเบียน
                  </span>
                </>
              ) : (
                <>
                  มีบัญชีแล้ว?{" "}
                  <span className={styles.link} onClick={() => { setMode("login"); setErrorMsg(null); }}>
                    เข้าสู่ระบบ
                  </span>
                </>
              )}
            </div>

            {errorMsg && (
              <div className={styles.errorBox} role="alert">
                <span style={{ fontWeight: 900 }}>✖</span>
                <span>{errorMsg}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
