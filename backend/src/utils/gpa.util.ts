/**
 * src/utils/gpa.util.ts
 * ======================================================
 * Utility สำหรับ "แปลงเกรดตัวอักษร -> คะแนน GP (Grade Point)"
 *
 * ทำไมต้องมีไฟล์นี้?
 * - ระบบตรวจจบ/คำนวณ GPA ต้องแปลงเกรดเป็นตัวเลขก่อน
 * - เราแยกเป็น util เพื่อให้เรียกใช้ซ้ำได้หลายที่ (Dashboard, Graduation check)
 *
 * หมายเหตุ:
 * - มาตรฐานที่ใช้เป็นแบบที่พบได้บ่อยในมหาวิทยาลัยไทย
 * - ถ้าหลักสูตร/มหาลัยของตี้ใช้ mapping ต่างกัน สามารถปรับ map ได้ตรงนี้จุดเดียว
 */

export function gradeToPoint(gradeRaw: string): number {
  const grade = String(gradeRaw).trim().toUpperCase();

  const map: Record<string, number> = {
    "A": 4.0,
    "B+": 3.5,
    "B": 3.0,
    "C+": 2.5,
    "C": 2.0,
    "D+": 1.5,
    "D": 1.0,
    "F": 0.0,
  };

  // เกรดพิเศษ (W ถอน, I ติดค้าง, S/U ผ่านแบบไม่คิดเกรด) -> ปกติไม่เอาไปคิด GPA
  // ในเวอร์ชันนี้ เราจะคืนค่า 0 และให้ service เป็นคน decide ว่าเอาเข้าคำนวณไหม
  return map[grade] ?? 0;
}

/**
 * เช็กว่าเกรดนี้ "ควรถูกนำไปคำนวณ GPA" หรือไม่
 * - W (ถอน), I (Incomplete) มักไม่คิด GPA
 * - S/U บางที่ไม่คิด GPA เช่นกัน
 */
export function isGradeCountedInGPA(gradeRaw: string): boolean {
  const grade = String(gradeRaw).trim().toUpperCase();
  if (grade === "W" || grade === "I") return false;
  if (grade === "S" || grade === "U") return false;
  return true;
}

/**
 * เช็กผ่าน/ไม่ผ่านรายวิชาแบบพื้นฐาน
 * - Default: ไม่ใช่ F ถือว่า "ผ่าน"
 * - ถ้าตี้ต้องการเกรดขั้นต่ำ (เช่น ต้อง >= C) จะทำในชั้น rule/requirement ต่อไป
 */
export function isPassed(gradeRaw: string): boolean {
  const grade = String(gradeRaw).trim().toUpperCase();
  if (grade === "F") return false;
  if (grade === "W" || grade === "I") return false; // ยังไม่ถือว่าผ่าน
  return true;
}
