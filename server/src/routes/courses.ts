import { Response, Router } from "express";
import Course, { ICourse, PROPOSAL_STATUS, COURSE_STATUS } from "../models/Course"
import { IGetUserAuthInfoRequest, authCheck } from "../middleware/auth";
import { ROLES, IUser } from "../models/User";
import { sendAcceptEmail, sendRejectEmail } from "../config/mailer";

const courseRouter = Router();

function search(search_term) {
  return Course.find(search_term).populate('professors');;
}

// this function is janky - should use a legit library
function strToBool(str: string): boolean {
  const test = str.trim().toLowerCase();
  return !((test === 'false') || (test === '0') || (test === ''));
}

// search courses
courseRouter.get("/search/:finalized", authCheck, async (req: IGetUserAuthInfoRequest, res: Response) => {

  const search_term = req.query;
  let finalized_term = {};

  if (!search_term.proposal_status && typeof req.params.finalized !== 'undefined') { // if finalized exists (has been set)
    if (strToBool(req.params.finalized)) { // if finalized is true
      finalized_term = { proposal_status: PROPOSAL_STATUS.CCC_ACCEPTED };
    } else { // want proposed courses
      finalized_term = { proposal_status: { $ne: PROPOSAL_STATUS.CCC_ACCEPTED } };
    }
  }

  // console.log({ ...search_term, ...finalized_term})

  try {
    const result = await search({ ...search_term, ...finalized_term });
    res.status(200).json({ result });
  } catch (err) {
    res.status(400).json({
      message: "at least one of the fields in the search term has the wrong type; see ICourse in models/Courses.ts for correct types",
    });
  }
});

// NOT TO BE USED BY FRONTEND
courseRouter.get("/search-dev-only/:finalized", async (req: IGetUserAuthInfoRequest, res: Response) => {
  const search_term = req.query;
  let finalized_term = {};

  if (!search_term.proposal_status && typeof req.params.finalized !== 'undefined') { // if finalized exists (has been set)
    if (strToBool(req.params.finalized)) { // if finalized is true
      finalized_term = { proposal_status: PROPOSAL_STATUS.CCC_ACCEPTED };
    } else { // want proposed courses
      finalized_term = { proposal_status: { $ne: PROPOSAL_STATUS.CCC_ACCEPTED } };
    }
  }

  try {
    const result = await search({ ...search_term, ...finalized_term });
    if (result.length === 0) {
      res.status(400).json({
        message: "No results found.",
      });
    } else {
      res.status(200).json({ result });
    }
  } catch (err) {
    res.status(400).json({
      message: "at least one of the fields in the search term has the wrong type; see ICourse in models/Courses.ts for correct types",
    });
  }
});

function getCourseStatus(proposed_course, original_course) {
  console.log(proposed_course);
  console.log(original_course);
  if (!original_course) {
    return COURSE_STATUS.NEW;
  }
  if (original_course.course_title === proposed_course.course_title &&
    original_course.description === proposed_course.description &&
    original_course.is_RPP === proposed_course.is_RPP &&
    original_course.is_remote === proposed_course.is_remote &&
    original_course.is_WRIT === proposed_course.is_WRIT) {
    return COURSE_STATUS.EXISTING;
  } else {
    return COURSE_STATUS.REVISED;
  }
};

interface ICourseProposalRequest {
  original?: ICourse,
  proposed: ICourse,
}

// submit a course
courseRouter.post("/submit", authCheck, async (req: IGetUserAuthInfoRequest, res: Response) => {
  const proposalRequest = req.body as ICourseProposalRequest;
  const status = getCourseStatus(proposalRequest.proposed, proposalRequest.original);

  if ((await Course.find(proposalRequest.proposed)).length > 0) { // duplicate course
    res.status(400).json({
      message: "cannot submit a duplicate course",
    });
    return;
  }

  if (req.user.role !== ROLES.DEFAULT) {
    const newCourse = await Course.create({
      ...proposalRequest.proposed,
      proposal_status: PROPOSAL_STATUS.DIRECTOR_REVIEW,
      course_status: status
    });
    res.status(200).json({ newCourse });

    // TODO: notify relevant parties via email
  } else {
    res.status(400).json({
      message: "submission failed",
    });
  }
});

// edit a course
courseRouter.post("/edit", authCheck, async (req: IGetUserAuthInfoRequest, res: Response) => {
  var course = req.body as ICourse;

  if (req.user.role !== ROLES.MANAGER) {
    // if you don't own the course
    if (!course.professors.includes((req.user._id as any).valueOf())) {
      res.status(403).json({
        message: "Do not have permission to edit another professor's course"
      });
      return;
    } else if (
      course.proposal_status != PROPOSAL_STATUS.CCC_REJECTED &&
      course.proposal_status != PROPOSAL_STATUS.DIRECTOR_REJECTED &&
      course.proposal_status != PROPOSAL_STATUS.DIRECTOR_REVIEW) {
      res.status(403).json({
        message: "Cannot edit a course unless proposal status is under review by a director, rejected by director, or rejected by CCC"
      });
      return;
    }
  }

  if (req.user.role !== ROLES.MANAGER) {
    course.proposal_status = PROPOSAL_STATUS.DIRECTOR_REVIEW;
  }

  try {
    await Course.updateOne({ _id: course._id }, course);
    res.status(200).json({
      message: "editing course succeeded"
    });

  } catch (err) {
    res.status(400).json({
      message: "editing course failed",
    });
  }
});


// NOT TO BE USED BY FRONTEND
courseRouter.post("/submit-dev-only", async (req: IGetUserAuthInfoRequest, res: Response) => {
  const proposalRequest = req.body as ICourse;
  const newCourse = await Course.create({
    ...proposalRequest
  });
  res.status(200).json({ newCourse });
});

courseRouter.post("/accept-reject/:is_accept", authCheck, async (req: IGetUserAuthInfoRequest, res: Response) => {
  const isAccept = typeof req.params.is_accept !== 'undefined' && strToBool(req.params.is_accept);

  if (req.user.role === ROLES.MANAGER || req.user.role === ROLES.GRAD_DIRECTOR || req.user.role === ROLES.UG_DIRECTOR) {
    const { course, reason } = req.body as { course: ICourse, reason: string };
    let new_status;
    if (req.user.role === ROLES.UG_DIRECTOR && course.is_undergrad) {
      if (isAccept) {
        new_status = PROPOSAL_STATUS.DIRECTOR_ACCEPTED;;
      } else {
        new_status = PROPOSAL_STATUS.DIRECTOR_REJECTED;
      }
    } else if (req.user.role === ROLES.GRAD_DIRECTOR && !course.is_undergrad) {
      if (isAccept) {
        new_status = PROPOSAL_STATUS.DIRECTOR_ACCEPTED;
      } else {
        new_status = PROPOSAL_STATUS.DIRECTOR_REJECTED;
      }
    } else if (req.user.role === ROLES.MANAGER) {
      if (isAccept) {
        new_status = PROPOSAL_STATUS.CCC_ACCEPTED;
      } else {
        new_status = PROPOSAL_STATUS.CCC_REJECTED;
      }
    } else {
      res.status(403).json({
        message: "do not have permission to accept/reject this specific course",
      });
    }

    try {
      await Course.updateOne({ _id: course._id }, { proposal_status: new_status });

      // very janky with types - should be a better way to do this
      const courseDocument = await Course.findOne({ _id: course._id });
      const courseDocumentWithProfessors = await courseDocument.populate('professors');
      const profEmails = (courseDocumentWithProfessors.professors as unknown as IUser[]).map(p => p.email);
      // const profEmails = (((await Course.findOne({ _id: course._id })).populate('professors')).professors as unknown as IUser[]).map(p => p.email);
      
      if (isAccept) {
        sendAcceptEmail(profEmails, course, reason, req.user.role !== ROLES.MANAGER);
      } else {
        sendRejectEmail(profEmails, course, reason, req.user.role !== ROLES.MANAGER);
      }

      res.status(200).json({
        message: "accepting/rejected course succeeded"
      });

    } catch (err) {
      res.status(400).json({
        message: "accepting/rejecting course failed",
      });
    }

  } else {
    res.status(403).json({
      message: "do not have permission to accept/reject courses"

    });
  }
});

export default courseRouter;
