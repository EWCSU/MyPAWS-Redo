
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { parse } = require("csv-parse/sync");

const folder = path.join(__dirname, "..", "private-data");

const tables = [
  "JOB_QUEUE_RUN",
  "JOB_QUEUE_REQ",
  "JOB_QUEUE_SUBREQ",
  "JOB_QUEUE_COURSE",
  "SUB_REQ_AR"
];

function readTable(zip, tableName) {
  const entry = zip.getEntries().find(
    e => e.entryName.endsWith(`/${tableName}.txt`)
  );

  if (!entry) {
    throw new Error(`Missing table: ${tableName}`);
  }

  return parse(entry.getData().toString("utf8"), {
    columns: true,
    bom: true,
    delimiter: "\t",
    skip_empty_lines: true,
    trim: true
  });
}

const files = fs.readdirSync(folder).filter(
  file => file.toLowerCase().endsWith(".zip")
);

for (const file of files) {
  const zip = new AdmZip(path.join(folder, file));
  const data = {};

  console.log(`\nReading ${file}`);

  for (const table of tables) {
    data[table] = readTable(zip, table);
    console.log(`${table}: ${data[table].length} records`);
  }

  const runs = new Set(
    data.JOB_QUEUE_RUN.map(r => r.INT_SEQ_NO)
  );

  const requirements = new Set(
    data.JOB_QUEUE_REQ.map(
      r => `${r.JOBQ_SEQ_NO}|${r.RTABX}`
    )
  );

  const subrequirements = new Set(
    data.JOB_QUEUE_SUBREQ.map(
      r => `${r.JOBQ_SEQ_NO}|${r.RTABX}|${r.STABX}`
    )
  );

  const subrequirementIds = new Set(
    data.JOB_QUEUE_SUBREQ.map(r => r.SUBREQ_ID)
  );

  const valid =
    data.JOB_QUEUE_REQ.every(
      r => runs.has(r.JOBQ_SEQ_NO)
    ) &&
    data.JOB_QUEUE_SUBREQ.every(
      r => requirements.has(`${r.JOBQ_SEQ_NO}|${r.RTABX}`)
    ) &&
    data.JOB_QUEUE_COURSE.every(
      r => subrequirements.has(
        `${r.JOBQ_SEQ_NO}|${r.RTABX}|${r.STABX}`
      )
    ) &&
    data.SUB_REQ_AR.every(
      r => subrequirementIds.has(r.SUB_INT_SEQ_NO)
    );

  console.log(`Relationships valid: ${valid}`);

  if (!valid) {
    process.exitCode = 1;
  }
}
