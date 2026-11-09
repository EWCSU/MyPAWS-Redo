
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const AdmZip = require("adm-zip");
const { parse } = require("csv-parse/sync");

const dataFolder = path.join(__dirname, "..", "private-data");

const tables = [
  "JOB_QUEUE_RUN",
  "JOB_QUEUE_REQ",
  "JOB_QUEUE_SUBREQ",
  "JOB_QUEUE_COURSE",
  "SUB_REQ_AR"
];

const value = v => String(v ?? "").trim();
const optional = v => value(v) || null;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function readTable(zip, name) {
  const entry = zip.getEntries().find(e =>
    e.entryName.replaceAll("\\", "/").endsWith(`/${name}.txt`)
  );

  check(entry, `Missing ${name}.txt`);

  return parse(entry.getData().toString("utf8"), {
    columns: true,
    bom: true,
    delimiter: "\t",
    skip_empty_lines: true,
    trim: true
  });
}

function auditDate(input) {
  const match = /^(\d{1,2})-([A-Z]{3})-(\d{2})$/
    .exec(value(input).toUpperCase());

  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
  ];

  check(
    match && months.includes(match[2]),
    `Unexpected audit date: ${input}`
  );

  return new Date(Date.UTC(
    2000 + Number(match[3]),
    months.indexOf(match[2]),
    Number(match[1])
  ));
}

function prepare(file) {
  const zip = new AdmZip(path.join(dataFolder, file));

  const data = Object.fromEntries(
    tables.map(t => [t, readTable(zip, t)])
  );

  check(data.JOB_QUEUE_RUN.length === 1,
    `${file}: expected exactly one audit`);

  const run = data.JOB_QUEUE_RUN[0];
  const auditId = randomUUID();

  const reqIds = new Map();
  const subIds = new Map();
  const sourceSubIds = new Map();

  const requirements = data.JOB_QUEUE_REQ.map(r => {
    check(value(r.JOBQ_SEQ_NO) === value(run.INT_SEQ_NO),
      "Requirement audit mismatch");

    const key = value(r.RTABX);

    check(key && !reqIds.has(key),
      `Duplicate requirement: ${key}`);

    const id = randomUUID();
    reqIds.set(key, id);

    return {
      id,
      degreeAuditId: auditId,
      sourceRtabx: key,
      sourceName: optional(r.RNAME),
      title: optional(r.LABEL) ||
        optional(r.RNAME) ||
        optional(r.CATEGORY),
      satisfiedCode: optional(r.SATISFIED),
      sourceData: r
    };
  });

  const subrequirements = data.JOB_QUEUE_SUBREQ.map(r => {
    check(value(r.JOBQ_SEQ_NO) === value(run.INT_SEQ_NO),
      "Subrequirement audit mismatch");

    const parent = reqIds.get(value(r.RTABX));
    const key = `${value(r.RTABX)}|${value(r.STABX)}`;
    const sourceId = value(r.SUBREQ_ID);

    check(
      parent && sourceId &&
      !subIds.has(key) &&
      !sourceSubIds.has(sourceId),
      `Invalid subrequirement: ${key}`
    );

    const id = randomUUID();

    subIds.set(key, id);
    sourceSubIds.set(sourceId, id);

    return {
      id,
      requirementId: parent,
      sourceStabx: value(r.STABX),
      sourceSubreqId: sourceId,
      title: optional(r.STITLE),
      satisfiedCode: optional(r.SATISFIED),
      sourceData: r
    };
  });

  const courses = data.JOB_QUEUE_COURSE.map(r => {
    check(value(r.JOBQ_SEQ_NO) === value(run.INT_SEQ_NO),
      "Course audit mismatch");

    const parent = subIds.get(
      `${value(r.RTABX)}|${value(r.STABX)}`
    );

    check(
      parent && value(r.INT_SEQ_NO) && value(r.COURSE),
      "Unmatched or incomplete course"
    );

    return {
      id: randomUUID(),
      subrequirementId: parent,
      sourceIntSeqNo: value(r.INT_SEQ_NO),
      courseCode: value(r.COURSE),
      courseTitle: optional(r.CTITLE),
      termCode: optional(r.YT),
      grade: optional(r.GRADE),
      credits: optional(r.CREDIT),
      inProgressCode: optional(r.IP),
      sourceData: r
    };
  });

  const rules = data.SUB_REQ_AR.map(r => {
    check(value(r.JOBQ_SEQ_NO) === value(run.INT_SEQ_NO),
      "Allowed-course audit mismatch");

    const parent = sourceSubIds.get(
      value(r.SUB_INT_SEQ_NO)
    );

    check(parent && value(r.INT_SEQ_NO),
      "Unmatched or incomplete allowed-course rule");

    return {
      id: randomUUID(),
      subrequirementId: parent,
      sourceIntSeqNo: value(r.INT_SEQ_NO),
      coursePattern: optional(r.COURSE),
      ruleType: optional(r.AR_TYPE),
      sourceData: r
    };
  });

  check(
    new Set(courses.map(c =>
      `${c.subrequirementId}|${c.sourceIntSeqNo}`
    )).size === courses.length,
    "Duplicate course source identifiers"
  );

  check(
    new Set(rules.map(r =>
      `${r.subrequirementId}|${r.sourceIntSeqNo}`
    )).size === rules.length,
    "Duplicate allowed-course source identifiers"
  );

  return {
    file, run, auditId,
    requirements, subrequirements, courses, rules
  };
}

async function main() {
  const files = fs.readdirSync(dataFolder)
    .filter(f => f.toLowerCase().endsWith(".zip"));

  check(files.length === 2,
    `Expected 2 ZIP files; found ${files.length}`);

  const prepared = files.map(prepare);

  for (const d of prepared) {
    console.log(
      `${d.file}: 1 audit, ` +
      `${d.requirements.length} requirements, ` +
      `${d.subrequirements.length} subrequirements, ` +
      `${d.courses.length} courses, ` +
      `${d.rules.length} allowable-course rules`
    );
  }

  if (!process.argv.includes("--import")) {
    console.log("Preview complete. No database changes made.");
    return;
  }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  try {
    for (const d of prepared) {
      const sequence = value(d.run.INT_SEQ_NO);

      const existing = await prisma.degreeAudit.findUnique({
        where: { sourceAuditSequence: sequence }
      });

      if (existing) {
        console.log(`Skipping ${d.file}: audit already imported`);
        continue;
      }

      await prisma.$transaction(async tx => {
        const student = await tx.studentRecord.upsert({
          where: { studentNumber: value(d.run.STUNO) },
          update: {},
          create: {
            studentNumber: value(d.run.STUNO),
            name: value(d.run.STUNAME),
            programCode: optional(d.run.DPROG),
            programTitle: optional(d.run.WEBTITLE) ||
              optional(d.run.DPTITLE1)
          }
        });

        await tx.degreeAudit.create({
          data: {
            id: d.auditId,
            studentRecordId: student.id,
            sourceAuditSequence: sequence,
            sourceJobId: optional(d.run.JOBID),
            programCode: value(d.run.DPROG),
            programTitle: value(d.run.WEBTITLE) ||
              value(d.run.DPTITLE1),
            runDate: auditDate(d.run.RUNDATE)
          }
        });

        await tx.degreeRequirement.createMany({
          data: d.requirements
        });

        await tx.degreeSubrequirement.createMany({
          data: d.subrequirements
        });

        await tx.auditCourse.createMany({
          data: d.courses
        });

        await tx.allowedCourseRule.createMany({
          data: d.rules
        });

      }, { maxWait: 20000, timeout: 120000 });

      console.log(`Imported ${d.file} successfully`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error("Import failed:", err.message);
  process.exitCode = 1;
});
