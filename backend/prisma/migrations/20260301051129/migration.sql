-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PLANNED', 'ENROLLED', 'PASSED', 'FAILED', 'DROPPED');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "RuleLanguage" AS ENUM ('SPARQL', 'NOTE');

-- CreateEnum
CREATE TYPE "TermType" AS ENUM ('SEMESTER', 'SUMMER');

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "profileImageFileId" INTEGER,
    "profileImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" SERIAL NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curriculum" (
    "id" SERIAL NOT NULL,
    "curriculumName" TEXT NOT NULL,
    "totalMinCredits" INTEGER NOT NULL,

    CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseNameTH" TEXT NOT NULL,
    "courseNameEN" TEXT,
    "credits" INTEGER NOT NULL,
    "creditDetail" TEXT,
    "curriculumId" INTEGER NOT NULL,
    "groupId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGroup" (
    "id" SERIAL NOT NULL,
    "groupCode" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupNameEN" TEXT,
    "curriculumId" INTEGER NOT NULL,
    "parentGroupId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePrerequisite" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "prereqCourseId" INTEGER NOT NULL,

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditRequirement" (
    "id" SERIAL NOT NULL,
    "minCredits" INTEGER NOT NULL,
    "curriculumId" INTEGER NOT NULL,
    "courseGroupId" INTEGER NOT NULL,

    CONSTRAINT "CreditRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" SERIAL NOT NULL,
    "planId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "curriculumId" INTEGER NOT NULL,
    "trackId" INTEGER,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" SERIAL NOT NULL,
    "termYear" INTEGER NOT NULL,
    "termNo" INTEGER NOT NULL,
    "termType" "TermType" NOT NULL DEFAULT 'SEMESTER',
    "studyPlanId" INTEGER NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntry" (
    "id" SERIAL NOT NULL,
    "termId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PLANNED',
    "grade" TEXT,
    "earnedCredits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameTH" TEXT NOT NULL,
    "nameEN" TEXT,
    "descriptionTH" TEXT,
    "descriptionEN" TEXT,
    "curriculumId" INTEGER NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackPlanTerm" (
    "id" SERIAL NOT NULL,
    "trackId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "termNo" INTEGER NOT NULL,
    "termType" "TermType" NOT NULL DEFAULT 'SEMESTER',
    "suggestedTotalCredits" INTEGER,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TrackPlanTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackPlanCourse" (
    "id" SERIAL NOT NULL,
    "termTemplateId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "noteTH" TEXT,
    "noteEN" TEXT,

    CONSTRAINT "TrackPlanCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackPlanSlot" (
    "id" SERIAL NOT NULL,
    "termTemplateId" INTEGER NOT NULL,
    "slotCode" TEXT NOT NULL,
    "titleTH" TEXT NOT NULL,
    "titleEN" TEXT,
    "groupCode" TEXT NOT NULL,
    "requiredCredits" INTEGER,
    "requiredCourses" INTEGER,
    "noteTH" TEXT,
    "noteEN" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TrackPlanSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRule" (
    "id" SERIAL NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleText" TEXT NOT NULL,
    "severity" "RuleSeverity" NOT NULL,
    "language" "RuleLanguage" NOT NULL,

    CONSTRAINT "ValidationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" SERIAL NOT NULL,
    "studyPlanId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "RuleSeverity" NOT NULL,
    "termId" INTEGER,
    "courseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "yearNo" INTEGER NOT NULL,
    "termNo" INTEGER NOT NULL,
    "grade" DOUBLE PRECISION,
    "credits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_username_key" ON "UserAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Curriculum_curriculumName_key" ON "Curriculum"("curriculumName");

-- CreateIndex
CREATE UNIQUE INDEX "Course_courseCode_key" ON "Course"("courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGroup_groupCode_key" ON "CourseGroup"("groupCode");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePrerequisite_courseId_prereqCourseId_key" ON "CoursePrerequisite"("courseId", "prereqCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlan_planId_key" ON "StudyPlan"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Term_studyPlanId_termYear_termNo_key" ON "Term"("studyPlanId", "termYear", "termNo");

-- CreateIndex
CREATE INDEX "PlanEntry_termId_idx" ON "PlanEntry"("termId");

-- CreateIndex
CREATE INDEX "PlanEntry_courseId_idx" ON "PlanEntry"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_code_key" ON "Track"("code");

-- CreateIndex
CREATE INDEX "TrackPlanCourse_termTemplateId_idx" ON "TrackPlanCourse"("termTemplateId");

-- CreateIndex
CREATE INDEX "TrackPlanCourse_courseId_idx" ON "TrackPlanCourse"("courseId");

-- CreateIndex
CREATE INDEX "TrackPlanSlot_termTemplateId_idx" ON "TrackPlanSlot"("termTemplateId");

-- CreateIndex
CREATE INDEX "TrackPlanSlot_groupCode_idx" ON "TrackPlanSlot"("groupCode");

-- CreateIndex
CREATE UNIQUE INDEX "TrackPlanSlot_termTemplateId_slotCode_key" ON "TrackPlanSlot"("termTemplateId", "slotCode");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationRule_ruleCode_key" ON "ValidationRule"("ruleCode");

-- CreateIndex
CREATE INDEX "ValidationResult_runId_idx" ON "ValidationResult"("runId");

-- CreateIndex
CREATE INDEX "ValidationResult_ruleId_idx" ON "ValidationResult"("ruleId");

-- CreateIndex
CREATE INDEX "ValidationResult_termId_idx" ON "ValidationResult"("termId");

-- CreateIndex
CREATE INDEX "ValidationResult_courseId_idx" ON "ValidationResult"("courseId");

-- CreateIndex
CREATE INDEX "Transcript_studentId_idx" ON "Transcript"("studentId");

-- CreateIndex
CREATE INDEX "Transcript_courseId_idx" ON "Transcript"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_studentId_courseId_yearNo_termNo_key" ON "Transcript"("studentId", "courseId", "yearNo", "termNo");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_profileImageFileId_fkey" FOREIGN KEY ("profileImageFileId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroup" ADD CONSTRAINT "CourseGroup_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroup" ADD CONSTRAINT "CourseGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "CourseGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_prereqCourseId_fkey" FOREIGN KEY ("prereqCourseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRequirement" ADD CONSTRAINT "CreditRequirement_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRequirement" ADD CONSTRAINT "CreditRequirement_courseGroupId_fkey" FOREIGN KEY ("courseGroupId") REFERENCES "CourseGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPlanTerm" ADD CONSTRAINT "TrackPlanTerm_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPlanCourse" ADD CONSTRAINT "TrackPlanCourse_termTemplateId_fkey" FOREIGN KEY ("termTemplateId") REFERENCES "TrackPlanTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPlanCourse" ADD CONSTRAINT "TrackPlanCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPlanSlot" ADD CONSTRAINT "TrackPlanSlot_termTemplateId_fkey" FOREIGN KEY ("termTemplateId") REFERENCES "TrackPlanTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ValidationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
