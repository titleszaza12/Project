# Study Plan System

ระบบวางแผนการเรียนและตรวจสอบเงื่อนไขการสำเร็จการศึกษา สำหรับนักศึกษาสาขาเทคโนโลยีสารสนเทศ  
พัฒนาขึ้นเพื่อช่วยให้นักศึกษาสามารถตรวจสอบแผนการเรียนของตนเอง จัดการรายวิชาที่ต้องลงทะเบียน และประเมินความพร้อมในการจบการศึกษาได้อย่างเป็นระบบ

---

## วัตถุประสงค์ของระบบ

ระบบนี้ถูกออกแบบมาเพื่อแก้ปัญหาการวางแผนการเรียนที่ซับซ้อน เช่น

- รายวิชาที่มีเงื่อนไขก่อนเรียน
- การเก็บหน่วยกิตให้ครบตามหลักสูตร
- การตรวจสอบหมวดวิชาและวิชาบังคับ
- การติดตามความคืบหน้าในการเรียน
- การตรวจสอบว่านักศึกษาผ่านเกณฑ์จบการศึกษาหรือไม่

---

## ความสามารถหลักของระบบ

### 1. สมัครสมาชิกและเข้าสู่ระบบ
ผู้ใช้งานสามารถสมัครสมาชิกและเข้าสู่ระบบด้วยรหัสนักศึกษาและรหัสผ่าน

### 2. จัดการข้อมูลส่วนตัว
ผู้ใช้สามารถดูและแก้ไขข้อมูล รวมถึงอัปโหลดรูปโปรไฟล์

### 3. ดูรายวิชาทั้งหมดในหลักสูตร
- รหัสวิชา
- ชื่อรายวิชา
- จำนวนหน่วยกิต
- หมวดวิชา
- เงื่อนไขก่อนเรียน

### 4. วางแผนการเรียน
สามารถจัดแผนการเรียนตามภาคการศึกษา

### 5. ตรวจสอบแผนการเรียน
ระบบตรวจสอบ:
- Prerequisite
- Credit Requirement
- Course Group
- Mandatory Courses
- Study Plan Sequence
- Track Requirement
- Graduation Check

### 6. ตรวจสอบจบการศึกษา
แสดงสถานะผ่าน / ไม่ผ่าน พร้อมรายละเอียด

---

## เทคโนโลยีที่ใช้

### Frontend
- Next.js
- React

### Backend
- Node.js
- Express

### Database
- PostgreSQL

### ORM
- Prisma

### Infrastructure
- Docker

---

## เวอร์ชันของซอฟต์แวร์

- Node.js >= 18
- npm >= 9
- Docker Desktop (latest)
- Prisma >= 6
- Next.js >= 13

---

## โครงสร้างโปรเจกต์

    Project/
    ├── backend
    ├── frontend
    ├── docker-compose.yml
    └── README.md

---

## ซอฟต์แวร์ที่ต้องติดตั้งก่อนใช้งาน

- Git  
- Node.js  
- Docker Desktop  
- Web Browser  

---

## การติดตั้งและเริ่มต้นใช้งานระบบ

### 1. Clone โปรเจกต์

    git clone https://github.com/titleszaza12/Project.git
    cd Project

---

### 2. ติดตั้ง Backend

    cd backend
    npm install

---

### 3. ติดตั้ง Frontend

    cd ../frontend
    npm install
    cd ..

---

### 4. เปิดฐานข้อมูล

    docker compose up -d

ตรวจสอบ

    docker ps

ปิด

    docker compose down

---

### 5. ตั้งค่า Backend

สร้างไฟล์

    backend/.env

ใส่ค่า

    DATABASE_URL=postgresql://postgres:postgres@localhost:5433/studyplan?schema=public
    PORT=3001
    JWT_SECRET=your_secret_key

---

### 6. สร้างฐานข้อมูล

    cd backend
    npx prisma migrate dev

Seed ข้อมูลเริ่มต้น (ถ้ามี)

    npx prisma db seed

ดูข้อมูลในฐานข้อมูล

    npx prisma studio

---

### 7. รัน Backend

    npm run dev

Backend:

    http://localhost:3001

---

### 8. ตั้งค่า Frontend

สร้างไฟล์

    frontend/.env.local

ใส่ค่า

    NEXT_PUBLIC_API_URL=http://localhost:3001

---

### 9. รัน Frontend

    cd frontend
    npm run dev

Frontend:

    http://localhost:3000

---

## วิธีใช้งานระบบ

1. สมัครสมาชิกและเข้าสู่ระบบ  
2. เลือกรายวิชาและสร้างแผนการเรียน  
3. ระบบตรวจสอบความถูกต้องของแผน  
4. ระบบแสดงผลสถานะการจบการศึกษา  
5. ปรับแผนการเรียนตามผลลัพธ์  

---

## ลำดับการเปิดระบบ

1. เปิด Docker  
2. รันฐานข้อมูล  
3. รัน Backend  
4. รัน Frontend  
5. เข้า http://localhost:3000  

---

## หมายเหตุ

- ต้องรัน Backend ก่อน Frontend  
- ต้อง migrate database ก่อนใช้งาน  
- npm install จะติดตั้งไลบรารีทั้งหมดอัตโนมัติ  
- หาก Docker ไม่ทำงาน ระบบจะไม่สามารถเชื่อมต่อฐานข้อมูลได้  