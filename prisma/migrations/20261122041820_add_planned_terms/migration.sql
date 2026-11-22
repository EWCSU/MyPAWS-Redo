-- CreateTable
CREATE TABLE "planned_terms" (
    "id" TEXT NOT NULL,
    "academicPlanId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planned_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planned_terms_academicPlanId_term_year_key" ON "planned_terms"("academicPlanId", "term", "year");

-- AddForeignKey
ALTER TABLE "planned_terms" ADD CONSTRAINT "planned_terms_academicPlanId_fkey" FOREIGN KEY ("academicPlanId") REFERENCES "academic_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
