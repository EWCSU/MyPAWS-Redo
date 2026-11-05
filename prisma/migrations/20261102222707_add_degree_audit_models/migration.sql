-- CreateTable
CREATE TABLE "degree_audits" (
    "id" TEXT NOT NULL,
    "studentRecordId" TEXT NOT NULL,
    "sourceAuditSequence" TEXT,
    "sourceJobId" TEXT,
    "programCode" TEXT NOT NULL,
    "programTitle" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "degree_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degree_requirements" (
    "id" TEXT NOT NULL,
    "degreeAuditId" TEXT NOT NULL,
    "sourceRtabx" TEXT NOT NULL,
    "sourceName" TEXT,
    "title" TEXT,
    "satisfiedCode" TEXT,
    "sourceData" JSONB,

    CONSTRAINT "degree_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degree_subrequirements" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "sourceStabx" TEXT NOT NULL,
    "sourceSubreqId" TEXT,
    "title" TEXT,
    "satisfiedCode" TEXT,
    "sourceData" JSONB,

    CONSTRAINT "degree_subrequirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_courses" (
    "id" TEXT NOT NULL,
    "subrequirementId" TEXT NOT NULL,
    "sourceIntSeqNo" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseTitle" TEXT,
    "termCode" TEXT,
    "grade" TEXT,
    "credits" DECIMAL(8,2),
    "inProgressCode" TEXT,
    "sourceData" JSONB,

    CONSTRAINT "audit_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_course_rules" (
    "id" TEXT NOT NULL,
    "subrequirementId" TEXT NOT NULL,
    "sourceIntSeqNo" TEXT NOT NULL,
    "coursePattern" TEXT,
    "ruleType" TEXT,
    "sourceData" JSONB,

    CONSTRAINT "allowed_course_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "degree_audits_sourceAuditSequence_key" ON "degree_audits"("sourceAuditSequence");

-- CreateIndex
CREATE INDEX "degree_audits_studentRecordId_runDate_idx" ON "degree_audits"("studentRecordId", "runDate");

-- CreateIndex
CREATE UNIQUE INDEX "degree_requirements_degreeAuditId_sourceRtabx_key" ON "degree_requirements"("degreeAuditId", "sourceRtabx");

-- CreateIndex
CREATE UNIQUE INDEX "degree_subrequirements_requirementId_sourceStabx_key" ON "degree_subrequirements"("requirementId", "sourceStabx");

-- CreateIndex
CREATE INDEX "audit_courses_courseCode_idx" ON "audit_courses"("courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "audit_courses_subrequirementId_sourceIntSeqNo_key" ON "audit_courses"("subrequirementId", "sourceIntSeqNo");

-- CreateIndex
CREATE UNIQUE INDEX "allowed_course_rules_subrequirementId_sourceIntSeqNo_key" ON "allowed_course_rules"("subrequirementId", "sourceIntSeqNo");

-- AddForeignKey
ALTER TABLE "degree_audits" ADD CONSTRAINT "degree_audits_studentRecordId_fkey" FOREIGN KEY ("studentRecordId") REFERENCES "student_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degree_requirements" ADD CONSTRAINT "degree_requirements_degreeAuditId_fkey" FOREIGN KEY ("degreeAuditId") REFERENCES "degree_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degree_subrequirements" ADD CONSTRAINT "degree_subrequirements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "degree_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_courses" ADD CONSTRAINT "audit_courses_subrequirementId_fkey" FOREIGN KEY ("subrequirementId") REFERENCES "degree_subrequirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowed_course_rules" ADD CONSTRAINT "allowed_course_rules_subrequirementId_fkey" FOREIGN KEY ("subrequirementId") REFERENCES "degree_subrequirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
