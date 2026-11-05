const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();


// Reads one of the txt files and turns each row into an object
function parseTxtFile(fileName) {

    const filePath = path.join(
        __dirname,
        "..",
        "data",
        fileName
    );

    const raw = fs.readFileSync(filePath, "utf8");

    // Splits the file into each row and removes empty lines
    const lines = raw
        .split(/\r?\n/)
        .filter(line => line.trim() !== "");

    // First row has all the column names
    const headers = lines[0]
        .split("\t")
        .map(value =>
            value.replaceAll('"', "").trim()
        );

    // Goes through each row and matches the values with the column names
    return lines.slice(1).map(line => {

        const values = line
            .split("\t")
            .map(value =>
                value.replaceAll('"', "").trim()
            );

        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] ?? "";
        });

        return row;
    });
}


// Gets the report data when /api/report is called
router.get("/", async (req, res) => {

    try {

        // Loads all of the sample PAWS report files
        const runs =
            parseTxtFile("JOB_QUEUE_RUN.txt");

        const requirements =
            parseTxtFile("JOB_QUEUE_REQ.txt");

        const subrequirements =
            parseTxtFile("JOB_QUEUE_SUBREQ.txt");

        const courses =
            parseTxtFile("JOB_QUEUE_COURSE.txt");

        const subReqRules =
            parseTxtFile("SUB_REQ_AR.txt");


        // For now just uses the first audit in the file
        const audit = runs[0];

        if (!audit) {
            return res.status(404).json({
                error: "No degree audit found."
            });
        }


        // Cleans up the course data so the frontend gets easier data to use
        const cleanedCourses = courses.map(course => ({

            code: course.COURSE,

            term: course.EDIT_YT || course.YT,

            units: Number(course.CREDIT || 0) / 10,

            grade: course.GRADE || null,

            gpa: Number(course.GPA || 0),

            inProgress: course.IP === "I"
        }));

        const cleanedRequirements = requirements
            .filter(req =>
                req.RTABX &&
                req.RNAME &&
                req.HIDDEN !== "H" &&
                req.HIDEFROMCHART !== "T" &&
                req.RNAME.trim() !== "REJECT" &&
                req.RNAME.trim() !== "LEGEND"
            )
            .map(req => ({
                rtabx: req.RTABX.trim(),

                name: req.RNAME?.trim() || "",

                category: req.CATEGORY?.trim() || "",

                label: req.LABEL?.trim() || "",

                status:
                    req.SATISFIED === "C"
                        ? "Completed"
                        : Number(req.IPHRS || 0) > 0 || Number(req.IPCT || 0) > 0
                            ? "In Progress"
                            : "Remaining",

                requiredHours: Number(req.REQHRS || 0),

                completedHours: Number(req.GOTHRS || 0),

                inProgressHours: Number(req.IPHRS || 0),

                neededHours: Number(req.NEEDHRS || 0),

                requiredGPA: Number(req.REQGPA || 0),

                currentGPA: Number(req.GOTGPA || 0)
        }));

        const cleanedSubrequirements = subrequirements
            .filter(sub =>
                sub.RTABX &&
                sub.STITLE &&
                sub.HIDDEN !== "H" &&
                sub.HIDETITLE !== "H"
                )
            .map(sub => ({
                rtabx: sub.RTABX.trim(),

                stabx: sub.STABX?.trim() || "",

                title: sub.STITLE?.trim() || "",

                status:
                    sub.SATISFIED === "C"
                        ? "Completed"
                        : Number(sub.IPHRS || 0) > 0 || Number(sub.IPCT || 0) > 0
                            ? "In Progress"
                            : "Remaining",

                requiredHours: Number(sub.REQHRS || 0),

                completedHours: Number(sub.GOTHRS || 0),

                inProgressHours: Number(sub.IPHRS || 0),

                neededHours: Number(sub.NEEDHRS || 0)
        }));


        // Sends all the report information back to the frontend
        return res.json({

            student: {
                studentNumber: audit.STUNO,
                name: audit.STUNAME,
                degreeProgram: audit.DPROG,
                degreeTitle: audit.WEBTITLE,
                runDate: audit.RUNDATE
            },

            requirements: cleanedRequirements,
            subrequirements: cleanedSubrequirements,

            courses: cleanedCourses,

            subRequirementRules: subReqRules
        });


    } catch (error) {

        console.error("Report error:", error);

        return res.status(500).json({
            error: "Could not load report."
        });
    }
});


module.exports = router;