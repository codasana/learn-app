/**
 * English Ladder — database schema
 *
 * Design notes (see V2/02-App-Build-Spec-v2.md §4 and §5):
 *  - Content items are independent and reusable. They belong to no unit.
 *  - A syllabus is an ordered playlist pointing at content items.
 *  - Progress lives on `enrollments` (one child, one syllabus). Class groups
 *    are scheduling only, and optional — a solo student is the normal case.
 *  - Vocabulary card state keys on the WORD, not the unit, so moving a child
 *    onto a new syllabus never resets their memory.
 */

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", [
  "parent",
  "student",
  "teacher",
  "owner",
]);

export const ageBand = pgEnum("age_band", ["8_9", "10_11", "any"]);

export const contentType = pgEnum("content_type", [
  "passage",
  "slides",
  "worksheet",
  "image",
  "audio",
  "video",
  "activity",
  "vocab_set",
  "quiz",
  "sentence_builder",
  "listening",
  "writing_task",
  "speaking_task",
]);

export const audience = pgEnum("audience", ["teacher", "student", "parent"]);

export const publishStatus = pgEnum("publish_status", ["draft", "published"]);

/**
 * Where a content item or syllabus belongs.
 *
 * The programme's thesis is a central library — content is written once and
 * reused for every future cohort, and that library is the long-term asset. So
 * `central` is the default and the norm.
 *
 * `private` exists for a teacher who writes something for their own students.
 * Promoting it into the shared library is a single flip of this column, which
 * is the whole point of modelling it this way rather than as separate tables.
 */
export const contentScope = pgEnum("content_scope", ["central", "private"]);

/**
 * Everything today is English, and will be for a long while. This exists only
 * so a second subject never requires touching every content query — adding a
 * value here is cheap, retrofitting the column would not be.
 */
export const subject = pgEnum("subject", ["english"]);

/** When a class material becomes visible to the student. */
export const releaseRule = pgEnum("release_rule", [
  "before",
  "during",
  "after",
  "never",
]);

export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "completed",
  "paused",
  "withdrawn",
]);

export const scheduledClassStatus = pgEnum("scheduled_class_status", [
  "scheduled",
  "completed",
  "cancelled",
  "rescheduled",
]);

export const attendanceStatus = pgEnum("attendance_status", [
  "present",
  "absent",
  "cancelled",
]);

export const rescheduleStatus = pgEnum("reschedule_status", [
  "pending",
  "approved",
  "declined",
]);

export const activityKind = pgEnum("activity_kind", [
  "reading",
  "listening",
  "sentence_builder",
  "quiz",
]);

/**
 * What shape the child's answer took.
 *
 * This is stored, not derived from the activity's type, because one activity
 * can accept more than one shape — "tell me about your family" is a fair task
 * whether the child writes it or records it, and a child who cannot type yet
 * should be able to photograph a page.
 */
export const submissionKind = pgEnum("submission_kind", [
  "text",
  "audio",
  "photo",
  "file",
  /** Structured answers — a puzzle's final state, the choices made. */
  "answers",
]);

export const submissionStatus = pgEnum("submission_status", [
  "submitted",
  "ai_drafted",
  "released",
  "redrafted",
]);

/**
 * `check_report` was `placement_report` until the funnel was renamed. The tool
 * is "the check", the people in it are enquiries, and a document kind called
 * placement was the last thing still speaking the old language.
 */
export const documentKind = pgEnum("document_kind", [
  "certificate",
  "term_report",
  "midterm_report",
  "check_report",
  "achievement_card",
  "share_card",
]);

/** How a family arrived. Cold traffic takes a tool; warm traffic asks. */
export const enquirySource = pgEnum("enquiry_source", [
  "tool", // finished a free tool and asked for the full report
  "demo_form", // "interested in your programme" — no tool involved
  "referral", // word of mouth from an existing parent
  "other",
]);

export const enquiryStatus = pgEnum("enquiry_status", [
  "new",
  "class_scheduled",
  "class_done",
  "report_sent",
  "enrolled",
  "declined",
  "dormant",
]);

/**
 * Which free tool a run belongs to.
 *
 * Adding a tool is a value here plus a definition in src/lib/tools — never a
 * new table. The tools are marketing, they come and go, and none of them may
 * reach into the programme's own tables.
 */
export const toolKind = pgEnum("tool_kind", ["level_check"]);

/* ------------------------------------------------------------------ */
/* Auth — Better Auth owns these four tables                           */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),

  /**
   * Better Auth requires an email on every user, but a child account is not
   * required to have one — collecting a child's email is the thing that
   * triggers COPPA/GDPR-K/DPDP obligations, so blank is the intended default.
   *
   * Children without an email therefore get a placeholder on the RFC 2606
   * reserved `.invalid` TLD, which is guaranteed never to resolve and so can
   * never accidentally receive mail. Use `hasRealEmail()` in src/lib/users.ts
   * rather than testing this column directly, and never send to it.
   */
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),

  /**
   * Set for student accounts (managed by the `username` Better Auth plugin).
   * A parent creates it, so it should not be identifying — first name and a
   * number is fine, full names are not.
   */
  username: text("username").unique(),
  displayUsername: text("display_username"),

  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  role: userRole("role").notNull().default("parent"),
  pinHash: text("pin_hash"),
  /** IANA timezone, e.g. "Asia/Dubai". All class times render in this zone. */
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  whatsapp: text("whatsapp"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Children                                                            */
/* ------------------------------------------------------------------ */

export const childProfiles = pgTable(
  "child_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The paying account. Billing, reports, and consent always live here. */
    parentId: text("parent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * The child's own sign-in, created BY THE PARENT. Nullable: a child can
     * always be reached through the parent's session and the profile picker,
     * so a direct login is optional. Both routes work.
     */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),

    /** First name only. No surname is ever stored. */
    firstName: text("first_name").notNull(),
    /** One of eight built-in avatars, by key. No photo of the child. */
    avatar: text("avatar").notNull().default("fox"),
    ageBand: ageBand("age_band").notNull().default("8_9"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("child_profiles_parent_idx").on(t.parentId),
    unique("child_profiles_user_unique").on(t.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* The funnel — before any account exists                              */
/*                                                                     */
/* Two tables, and they touch nothing below this line. The free tools  */
/* are marketing: they must be rewritable or deletable without any of  */
/* it reaching the syllabus, the content library, or a child's         */
/* progress. Nothing here references those tables, and nothing there   */
/* references these.                                                   */
/* ------------------------------------------------------------------ */

/**
 * A family who has shown interest but has not enrolled.
 *
 * No user account exists at this stage, deliberately: asking a parent to set a
 * password before we have delivered anything costs conversions, and if they
 * never enrol we should not be holding an account at all.
 *
 * Two ways in, one row either way — a child finishing a free tool and asking
 * for the full report, or a parent filling the "book a demo class" form. The
 * teacher's remarks after that class are notes on this row; a separate log of
 * interactions can wait until more than one person is writing them.
 *
 * Declined enquiries are kept as the re-marketing list for the next term, with
 * `purgeAfter` set 12 months out. That retention is disclosed on the form.
 */
/**
 * A family who has shown interest but has not enrolled.
 *
 * Keyed on the parent's email, which is the only identifier in this part of
 * the system worth trusting: we control every place it is collected, and we
 * send to it. A child's first name is NOT a key — it is free text a stranger
 * types, and "Nila", "Neela" and "Nila S" are three keys for one child.
 *
 * Parent details live here and nowhere else. They used to sit on each
 * enquiry, which meant a family with two children held two copies of one
 * phone number, and which row Sheeba opened decided what she dialled.
 *
 * Loops state lives here too, and this is where it belongs: a Loops contact
 * is keyed on email, so it maps to a family, never to one child.
 */
export const enquiryFamilies = pgTable(
  "enquiry_families",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Lower-cased on the way in. The identity of the whole row. */
    parentEmail: text("parent_email").notNull(),
    parentName: text("parent_name"),
    whatsapp: text("whatsapp"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),

    /**
     * What Loops last heard from us, and when.
     *
     * This row is the ONLY source of truth for a lead's stage. Loops is a
     * mirror we push to and never read back from — otherwise two systems own
     * the same fact and they will disagree on the day it matters.
     *
     * The mirror decides which automation a parent is sitting in, so a push
     * that quietly failed is not cosmetic: it is a family still being chased
     * for a class they have already had. Recording the stage we actually
     * pushed, rather than a boolean, is what makes that recoverable — see
     * scripts/sync-loops.ts.
     */
    loopsStage: text("loops_stage"),
    loopsSyncedAt: timestamp("loops_synced_at", { withTimezone: true }),

    /**
     * Set when every child of this family is declined; a scheduled job
     * removes the family after this date. Retention is disclosed on the form
     * and is a promise to the PARENT, so it is theirs, not a child's.
     */
    purgeAfter: date("purge_after"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("enquiry_families_email_key").on(t.parentEmail)],
);

/**
 * One conversation, about one child.
 *
 * The child is the unit of the funnel, not the family: a parent with two
 * children has two conversations and they move at different speeds — the
 * elder placed and enrolled while the younger is still an enquiry. A single
 * row per family would force those into one status.
 *
 * A child who was declined and comes back next term re-opens this row rather
 * than starting another, because what Sheeba wrote about them last time is
 * exactly what she wants to read before replying.
 *
 * Nothing here references the programme tables, and nothing there references
 * these. The free tools are marketing: they must be rewritable or deletable
 * without any of it reaching the syllabus, the content library, or a child's
 * progress.
 */
export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    familyId: uuid("family_id")
      .notNull()
      .references(() => enquiryFamilies.id, { onDelete: "cascade" }),

    /** First name only, same rule as enrolled children. Never a key. */
    childFirstName: text("child_first_name"),
    childAgeBand: ageBand("child_age_band"),
    childGrade: integer("child_grade"),

    source: enquirySource("source").notNull().default("demo_form"),
    status: enquiryStatus("status").notNull().default("new"),

    /** Cal.com booking reference for the free session. */
    calBookingId: text("cal_booking_id"),
    classAt: timestamp("class_at", { withTimezone: true }),

    /**
     * Where the teacher thinks this child should start.
     *
     * Levels are real in the programme — four of them, with definitions and
     * marketing behind each — and this is where they live: the conversation
     * with a parent. They are deliberately NOT a foreign key. Content and
     * syllabi carry no level, so nothing downstream is constrained by the
     * number quoted here. Aligned in practice, uncoupled in the schema.
     */
    suggestedLevel: integer("suggested_level"),
    startingLevel: integer("starting_level"),

    /** What the teacher saw in the session, and anything else worth keeping. */
    teacherNotes: text("teacher_notes"),
    notes: text("notes"),

    /**
     * The Automette submission this came from, when it came from a form.
     *
     * Unique, and it is what makes the webhook idempotent: Automette retries
     * with a stable event id, so the same enquiry legitimately arrives more
     * than once and must not become two children.
     */
    autometteSubmissionId: text("automette_submission_id"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("enquiries_status_idx").on(t.status),
    index("enquiries_family_idx").on(t.familyId),
    unique("enquiries_automette_submission_unique").on(t.autometteSubmissionId),
  ],
);
/**
 * One run of one free tool. Entirely self-contained.
 *
 * `responses` and `result` are the whole of it — the questions live in code
 * (src/lib/tools), the answers and the outcome live here, and neither points
 * at anything in the programme. A tool can be rewritten or dropped without a
 * migration touching anything a child is learning from.
 *
 * `enquiryId` is nullable on purpose. A run starts anonymous — no email, no
 * account, that is the entire advantage — and is linked to a family only when
 * a parent asks for the full report, or when the teacher issues the link
 * herself to someone who has already enquired.
 *
 * **The token in the URL is the only credential.** It grants this one run and
 * nothing else. That is proportionate to what is behind it — a first name and
 * a quiz score — and a login here would cost more conversions than it protects
 * anything. See src/lib/tool-runs.ts for the rules that keep it that way.
 */
export const toolRuns = pgTable(
  "tool_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tool: toolKind("tool").notNull(),

    enquiryId: uuid("enquiry_id").references(() => enquiries.id, {
      onDelete: "cascade",
    }),

    /** 32 random bytes, base64url. Not a session — scoped to this run alone. */
    token: text("token").notNull().unique(),

    childFirstName: text("child_first_name"),
    childAgeBand: ageBand("child_age_band"),

    /** Everything the child did. Shape is the tool's business. */
    responses: jsonb("responses").notNull().default({}),
    /** Scores, bands, whatever this tool produces. Also the tool's business. */
    result: jsonb("result").notNull().default({}),

    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    /** After this the link stops working and we offer a fresh one. */
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [
    index("tool_runs_enquiry_idx").on(t.enquiryId),
    index("tool_runs_tool_idx").on(t.tool, t.completedAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Content library — items are independent and reusable                */
/* ------------------------------------------------------------------ */

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: contentType("type").notNull(),
    title: text("title").notNull(),
    /** How mature the topic is. Nothing to do with how hard the English is. */
    ageBand: ageBand("age_band").notNull().default("any"),

    /**
     * Free-form, teacher-chosen: "family", "simple present", "week 1", "easy".
     *
     * There is deliberately no difficulty level here. A number 1–4 on every
     * passage asked the teacher a question she has no basis to answer while
     * writing, and would have been the default every time. Tags are how the
     * library gets organised instead — she invents the vocabulary that
     * matches how she actually thinks, and it costs nothing to change.
     */
    tags: text("tags").array().notNull().default([]),
    audience: audience("audience").notNull().default("student"),
    status: publishStatus("status").notNull().default("draft"),

    /**
     * Ownership, for the multi-teacher future. Nullable today because there is
     * one teacher; queries are deliberately NOT scoped by these yet.
     */
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    scope: contentScope("scope").notNull().default("central"),
    subject: subject("subject").notNull().default("english"),

    /** Type-specific payload. See spec §4.2. */
    body: jsonb("body").notNull().default({}),
    /** R2 key for slides / worksheet / image / audio / video. */
    fileUrl: text("file_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("content_items_lookup_idx").on(t.type, t.status)],
);

/* ------------------------------------------------------------------ */
/* Syllabus — an ordered playlist over the library                     */
/* ------------------------------------------------------------------ */

/**
 * A named, ordered playlist over the library. Nothing more.
 *
 * There is no level column. Which syllabus a child belongs on is the teacher's
 * judgement, made per child at enrollment — formalising it into levels would
 * be inventing a rule before anyone has taught enough to know what the rule
 * should be. The name carries whatever meaning is wanted for now.
 */
export const syllabi = pgTable("syllabi", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),

  /**
   * What this syllabus calls its chunks.
   *
   * The structure is a numbered, ordered unit of teaching — two classes and
   * some practice. "Week" is only the most common presentation of that, and it
   * stops being true for an intensive course, a holiday camp, a fortnightly
   * slot, or simply a child who takes three weeks over one unit. So the
   * database says `unit` everywhere and the teacher chooses the word her
   * families read.
   *
   * Same rule as `people` in lib/brand: internal names stay boring and stable,
   * the user-facing word lives in exactly one place.
   */
  unitLabel: text("unit_label").notNull().default("Week"),
  unitLabelPlural: text("unit_label_plural").notNull().default("Weeks"),
  version: integer("version").notNull().default(1),
  status: publishStatus("status").notNull().default("draft"),
  /** A teacher may build their own for specific students; see contentScope. */
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  scope: contentScope("scope").notNull().default("central"),
  subject: subject("subject").notNull().default("english"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const syllabusUnits = pgTable(
  "syllabus_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    syllabusId: uuid("syllabus_id")
      .notNull()
      .references(() => syllabi.id, { onDelete: "cascade" }),
    /** 1..n, dense and gapless. Rendered as "<unitLabel> <position>". */
    position: integer("position").notNull(),
    theme: text("theme").notNull(),
    grammarFocus: text("grammar_focus"),
  },
  (t) => [unique("syllabus_unit_unique").on(t.syllabusId, t.position)],
);

/** The child's self-study items for a unit. */
export const syllabusUnitItems = pgTable(
  "syllabus_unit_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    syllabusUnitId: uuid("syllabus_unit_id")
      .notNull()
      .references(() => syllabusUnits.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("syllabus_unit_items_unit_idx").on(t.syllabusUnitId)],
);

/** Class 1 and Class 2 of a unit. */
export const classSessions = pgTable(
  "class_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    syllabusUnitId: uuid("syllabus_unit_id")
      .notNull()
      .references(() => syllabusUnits.id, { onDelete: "cascade" }),
    classNumber: integer("class_number").notNull(), // 1 = input, 2 = output
    title: text("title").notNull(),
    planMd: text("plan_md"),
  },
  (t) => [unique("class_session_unique").on(t.syllabusUnitId, t.classNumber)],
);

/**
 * The ordered material list for one class. A class holds as many materials as
 * the teacher wants — slides, worksheet, passage, activity — each with its own
 * audience and release rule.
 */
export const classSessionMaterials = pgTable(
  "class_session_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classSessionId: uuid("class_session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Overrides the content item's own audience for this class only. */
    audienceOverride: audience("audience_override"),
    release: releaseRule("release").notNull().default("during"),
    /** Teacher flips this live during class for `release = 'during'`. */
    isRevealed: boolean("is_revealed").notNull().default(false),
  },
  (t) => [index("class_materials_session_idx").on(t.classSessionId)],
);

/* ------------------------------------------------------------------ */
/* Enrollments (progress) and class groups (scheduling)                */
/* ------------------------------------------------------------------ */

/** Scheduling only — who shares a live class slot. Optional. */
export const classGroups = pgTable("class_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Who teaches this group. Nullable while there is a single teacher. */
  teacherId: text("teacher_id").references(() => users.id, {
    onDelete: "set null",
  }),
  meetingUrl: text("meeting_url"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Progress. One child, one syllabus version, their own unit pointer.
 * `classGroupId` is nullable — a solo student needs no group.
 */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    syllabusId: uuid("syllabus_id")
      .notNull()
      .references(() => syllabi.id, { onDelete: "restrict" }),
    classGroupId: uuid("class_group_id").references(() => classGroups.id, {
      onDelete: "set null",
    }),
    /** Who teaches this student. Nullable while there is a single teacher. */
    teacherId: text("teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startDate: date("start_date").notNull(),

    /*
     * When this child has their classes.
     *
     * A recurring slot rather than a booking: the same child at the same time
     * every week is agreed once, not booked over and over. Cal.com is for the
     * free first class, where a stranger picks a slot — it is the wrong shape
     * for ten weekly lessons.
     *
     * The time is wall-clock in `slotTimezone`, normally the teacher's, and
     * the actual instants are generated from it. Pinning it to her zone means
     * a family in London sees the class shift by an hour when their clocks
     * change, which is correct: the class did not move, their clocks did.
     */
    slotDays: integer("slot_days").array().notNull().default([]),
    /** "17:00", wall clock in `slotTimezone`. */
    slotTime: text("slot_time"),
    slotTimezone: text("slot_timezone").notNull().default("Asia/Kolkata"),
    durationMin: integer("duration_min").notNull().default(45),

    /**
     * One stable meeting room for this child, pasted once.
     *
     * Not generated per class: that needs a Google or Zoom integration, and
     * with a handful of families a link that never changes is both simpler and
     * kinder — the parent can bookmark it.
     */
    meetingUrl: text("meeting_url"),
    /** Which unit of the syllabus they are on. See syllabi.unitLabel. */
    currentUnit: integer("current_unit").notNull().default(1),
    status: enrollmentStatus("status").notNull().default("active"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("enrollments_child_idx").on(t.childId),
    index("enrollments_status_idx").on(t.status),
  ],
);

/** Swap or add a single item for a single child's unit. Escape hatch. */
export const enrollmentItemOverrides = pgTable("enrollment_item_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  syllabusUnitId: uuid("syllabus_unit_id")
    .notNull()
    .references(() => syllabusUnits.id, { onDelete: "cascade" }),
  /** Null means a pure addition rather than a replacement. */
  replacesContentItemId: uuid("replaces_content_item_id").references(
    () => contentItems.id,
    { onDelete: "cascade" },
  ),
  contentItemId: uuid("content_item_id")
    .notNull()
    .references(() => contentItems.id, { onDelete: "restrict" }),
  note: text("note"),
});

/* ------------------------------------------------------------------ */
/* Scheduling                                                          */
/* ------------------------------------------------------------------ */

export const scheduledClasses = pgTable(
  "scheduled_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Either a group class or a solo class — exactly one is set. */
    classGroupId: uuid("class_group_id").references(() => classGroups.id, {
      onDelete: "cascade",
    }),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    syllabusUnitId: uuid("syllabus_unit_id").references(() => syllabusUnits.id, {
      onDelete: "set null",
    }),
    classNumber: integer("class_number"), // 1 or 2
    teacherId: text("teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull().default(45),
    meetingUrl: text("meeting_url"),
    status: scheduledClassStatus("status").notNull().default("scheduled"),
    teacherRecapMd: text("teacher_recap_md"),
  },
  (t) => [index("scheduled_classes_starts_idx").on(t.startsAt)],
);

export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  scheduledClassId: uuid("scheduled_class_id")
    .notNull()
    .references(() => scheduledClasses.id, { onDelete: "cascade" }),
  childId: uuid("child_id")
    .notNull()
    .references(() => childProfiles.id, { onDelete: "cascade" }),
  status: attendanceStatus("status").notNull(),
  markedAt: timestamp("marked_at").notNull().defaultNow(),
});

export const rescheduleRequests = pgTable("reschedule_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  scheduledClassId: uuid("scheduled_class_id")
    .notNull()
    .references(() => scheduledClasses.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  proposedStartsAt: timestamp("proposed_starts_at", {
    withTimezone: true,
  }).notNull(),
  reason: text("reason"),
  status: rescheduleStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
});

/* ------------------------------------------------------------------ */
/* Practice and progress                                               */
/* ------------------------------------------------------------------ */

/**
 * Leitner box state for one word, for one child.
 * Keys on `wordKey` (the word itself, normalised) rather than a unit-scoped id,
 * so a child's memory follows them from one syllabus to the next.
 *
 * Intervals by box: 1 → 1d, 2 → 2d, 3 → 4d, 4 → 8d, 5 → 16d.
 */
export const cardStates = pgTable(
  "card_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    wordKey: text("word_key").notNull(),
    /** Denormalised for rendering; the vocab_set item that introduced it. */
    sourceItemId: uuid("source_item_id").references(() => contentItems.id, {
      onDelete: "set null",
    }),
    box: integer("box").notNull().default(1),
    dueDate: date("due_date").notNull(),
    correctStreak: integer("correct_streak").notNull().default(0),
    totalReviews: integer("total_reviews").notNull().default(0),
    totalCorrect: integer("total_correct").notNull().default(0),
    /** Additive only — never set back to false once true. */
    isMastered: boolean("is_mastered").notNull().default(false),
    lastReviewedAt: timestamp("last_reviewed_at"),
  },
  (t) => [
    unique("card_states_child_word_unique").on(t.childId, t.wordKey),
    index("card_states_due_idx").on(t.childId, t.dueDate),
  ],
);

export const activityCompletions = pgTable(
  "activity_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    kind: activityKind("kind").notNull(),
    contentItemId: uuid("content_item_id").references(() => contentItems.id, {
      onDelete: "set null",
    }),
    score: integer("score"),
    total: integer("total"),
    /** e.g. words the child tapped in a passage, for teacher visibility. */
    meta: jsonb("meta").notNull().default({}),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [index("activity_completions_child_idx").on(t.childId, t.completedAt)],
);

export const dailyProgress = pgTable(
  "daily_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    vocabDone: boolean("vocab_done").notNull().default(false),
    activitiesDone: integer("activities_done").notNull().default(0),
    todayCompleted: boolean("today_completed").notNull().default(false),
  },
  (t) => [unique("daily_progress_child_date_unique").on(t.childId, t.date)],
);

/* ------------------------------------------------------------------ */
/* Submissions — anything a child hands in for a person to answer       */
/* ------------------------------------------------------------------ */

/**
 * A child's answer to an activity, whatever shape that answer takes.
 *
 * This was `writing_submissions` and assumed prose, which was only ever true
 * of the first activity we built. A child recording themselves so Sheeba can
 * hear their speaking is the same transaction: they hand something in, and a
 * person — never the app — answers it. Photographed handwriting, a finished
 * puzzle and a piece of writing all sit here.
 *
 * The line this table draws is not "writing vs other". It is:
 *
 *   activity_completions — the app can mark it (a quiz, a word review)
 *   submissions          — only a person can respond
 *
 * Which is why every row carries review and release columns, and why nothing
 * auto-marked lives here.
 */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    /** The activity being answered — any content type, not just writing. */
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "restrict" }),
    kind: submissionKind("kind").notNull().default("text"),

    /* --- the child's answer; which of these is used depends on `kind` --- */

    /** `text`. Also the transcript, when we ever transcribe audio. */
    body: text("body"),
    /**
     * `audio`, `photo`, `file` — a private R2 object. It may be a child's
     * voice or handwriting, so it is served by signed URL and never public.
     */
    mediaUrl: text("media_url"),
    /** Length of an audio or video answer, so the queue can say "0:42". */
    mediaSeconds: integer("media_seconds"),
    /** `answers` — whatever structure that activity defines. */
    payload: jsonb("payload").notNull().default({}),
    /** Working out: the planning boxes, a first attempt, notes to self. */
    notes: jsonb("notes").notNull().default({}),

    /* --- the response, which is always a person's --- */

    status: submissionStatus("status").notNull().default("submitted"),
    /**
     * NEVER select this column on a child- or parent-facing endpoint.
     * Teacher review and release is mandatory.
     */
    aiDraft: text("ai_draft"),
    teacherFeedback: text("teacher_feedback"),
    teacherVoiceUrl: text("teacher_voice_url"),
    redraftBody: text("redraft_body"),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    releasedAt: timestamp("released_at"),
  },
  (t) => [
    index("submissions_status_idx").on(t.status),
    index("submissions_child_idx").on(t.childId),
    /*
     * One row per child per activity. A redraft edits the row it belongs to
     * rather than making a second one, so the child and Sheeba are always
     * looking at the same conversation. Without this the read-then-write in
     * the submit action could quietly make duplicates.
     */
    uniqueIndex("submissions_child_item_key").on(t.childId, t.contentItemId),
  ],
);

export const parentNotes = pgTable("parent_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id")
    .notNull()
    .references(() => childProfiles.id, { onDelete: "cascade" }),
  /** The unit this note is about. See syllabi.unitLabel. */
  unitPosition: integer("unit_position").notNull(),
  body: text("body").notNull(),
  /** Which teacher wrote it. */
  authorId: text("author_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Generated documents (Automette) and achievements                    */
/* ------------------------------------------------------------------ */

export const generatedDocuments = pgTable("generated_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id").references(() => childProfiles.id, {
    onDelete: "cascade",
  }),
  enrollmentId: uuid("enrollment_id").references(() => enrollments.id, {
    onDelete: "cascade",
  }),
  kind: documentKind("kind").notNull(),
  autometteTemplateId: text("automette_template_id"),
  payload: jsonb("payload").notNull().default({}),
  fileUrl: text("file_url"),
  isReleased: boolean("is_released").notNull().default(false),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

/** Phase 2. Additive only — never removed, never compared between children. */
export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    threshold: integer("threshold"),
    cardUrl: text("card_url"),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
  },
  (t) => [unique("achievement_unique").on(t.childId, t.kind, t.threshold)],
);
