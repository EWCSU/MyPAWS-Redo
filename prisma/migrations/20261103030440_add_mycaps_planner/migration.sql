-- CreateTable
CREATE TABLE "academic_plans" (
    "id" TEXT NOT NULL,
    "studentRecordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_courses" (
    "id" TEXT NOT NULL,
    "academicPlanId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseTitle" TEXT,
    "term" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_plans_studentRecordId_key" ON "academic_plans"("studentRecordId");

-- CreateIndex
CREATE INDEX "planned_courses_academicPlanId_year_term_idx" ON "planned_courses"("academicPlanId", "year", "term");

-- CreateIndex
CREATE UNIQUE INDEX "planned_courses_academicPlanId_courseCode_term_year_key" ON "planned_courses"("academicPlanId", "courseCode", "term", "year");

-- AddForeignKey
ALTER TABLE "academic_plans" ADD CONSTRAINT "academic_plans_studentRecordId_fkey" FOREIGN KEY ("studentRecordId") REFERENCES "student_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_courses" ADD CONSTRAINT "planned_courses_academicPlanId_fkey" FOREIGN KEY ("academicPlanId") REFERENCES "academic_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
