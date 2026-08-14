/**
 * English Ladder — database schema
 *
 * Design notes (see V2/02-App-Build-Spec-v2.md §4 and §5):
 *  - Content items are independent and reusable. They belong to no week.
 *  - A syllabus is an ordered playlist pointing at content items.
 *  - Progress lives on `enrollments` (one child, one level). Class groups are
 *    scheduling only, and are optional — a solo student is the normal case.
 *  - Vocabulary card state keys on the WORD, not the week, so promotion to the
 *    next level never resets a child's memory.
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

export const writingStatus = pgEnum("writing_status", [
  "submitted",
  "ai_drafted",
  "released",
  "redrafted",
]);

export const documentKind = pgEnum("document_kind", [
  "certificate",
  "term_report",
  "midterm_report",
  "placement_report",
  "achievement_card",
  "share_card",
]);

/** How a lead entered the funnel. Cold traffic takes the tool; warm traffic books. */
export const leadSource = pgEnum("lead_source", [
  "tool", // public "check your child's English level" tool
  "referral", // word of mouth from an existing parent
  "direct", // booked straight from the marketing page
  "other",
]);

export const leadStatus = pgEnum("lead_status", [
  "new",
  "check_sent",
  "check_done",
  "session_booked",
  "session_done",
  "report_sent",
  "enrolled",
  "declined",
  "dormant",
]);

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
/* Leads and placement — the funnel BEFORE any account exists          */
/* ------------------------------------------------------------------ */

/**
 * A family who has shown interest but has not enrolled. No user account exists
 * at this stage, deliberately: asking a parent to create a password before we
 * have delivered any value costs conversions, and if they never enrol we should
 * not be storing an account at all.
 *
 * Declined leads are kept as the re-marketing list for the next term, with
 * `purgeAfter` set 12 months out. This retention is disclosed on the form.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentName: text("parent_name"),
    parentEmail: text("parent_email"),
    whatsapp: text("whatsapp"),

    /** First name only, same rule as enrolled children. */
    childFirstName: text("child_first_name"),
    childAgeBand: ageBand("child_age_band"),
    childGrade: integer("child_grade"),

    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    source: leadSource("source").notNull().default("direct"),
    status: leadStatus("status").notNull().default("new"),

    /** Cal.com booking reference for the free session. */
    calBookingId: text("cal_booking_id"),
    sessionAt: timestamp("session_at", { withTimezone: true }),

    /** What the app's check suggested, versus what the teacher decided. */
    suggestedLevel: integer("suggested_level"),
    finalLevel: integer("final_level"),
    /** Speaking and writing observations from the live session. */
    teacherNotes: text("teacher_notes"),

    notes: text("notes"),
    /** Set on decline; a scheduled job removes the row after this date. */
    purgeAfter: date("purge_after"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("leads_status_idx").on(t.status),
    index("leads_email_idx").on(t.parentEmail),
  ],
);

/**
 * One run of the public level-check tool.
 *
 * `leadId` is nullable on purpose: the tool is open to anyone with no email
 * required. A row starts anonymous and is linked to a lead only if the parent
 * asks for the full report afterwards. The token in the URL is the only
 * credential — it grants access to this attempt and nothing else.
 */
export const placementAttempts = pgTable(
  "placement_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    /** Long random, unguessable. Not a session — scoped to this attempt only. */
    token: text("token").notNull().unique(),

    childFirstName: text("child_first_name"),
    childAgeBand: ageBand("child_age_band"),

    /** Raw answers, for the teacher to inspect during the session. */
    responses: jsonb("responses").notNull().default({}),
    vocabScore: integer("vocab_score"),
    vocabTotal: integer("vocab_total"),
    readingScore: integer("reading_score"),
    readingTotal: integer("reading_total"),
    listeningScore: integer("listening_score"),
    listeningTotal: integer("listening_total"),

    /** Provisional only. The teacher makes the real call — see `leads.finalLevel`. */
    suggestedLevel: integer("suggested_level"),

    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [index("placement_attempts_lead_idx").on(t.leadId)],
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
    /** 1..4 — how hard the English is. */
    difficultyLevel: integer("difficulty_level").notNull(),
    /** How mature the topic is. Independent of difficulty. */
    ageBand: ageBand("age_band").notNull().default("any"),
    themeTags: text("theme_tags").array().notNull().default([]),
    grammarTags: text("grammar_tags").array().notNull().default([]),
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

    /** Type-specific payload. See spec §4.2. */
    body: jsonb("body").notNull().default({}),
    /** R2 key for slides / worksheet / image / audio / video. */
    fileUrl: text("file_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("content_items_lookup_idx").on(t.type, t.difficultyLevel, t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Syllabus — an ordered playlist over the library                     */
/* ------------------------------------------------------------------ */

export const syllabi = pgTable("syllabi", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: integer("level").notNull(),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  status: publishStatus("status").notNull().default("draft"),
  /** A teacher may build their own for specific students; see contentScope. */
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  scope: contentScope("scope").notNull().default("central"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const syllabusWeeks = pgTable(
  "syllabus_weeks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    syllabusId: uuid("syllabus_id")
      .notNull()
      .references(() => syllabi.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    theme: text("theme").notNull(),
    grammarFocus: text("grammar_focus"),
  },
  (t) => [unique("syllabus_week_unique").on(t.syllabusId, t.weekNumber)],
);

/** The child's self-study items for a week. */
export const syllabusWeekItems = pgTable(
  "syllabus_week_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    syllabusWeekId: uuid("syllabus_week_id")
      .notNull()
      .references(() => syllabusWeeks.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("syllabus_week_items_week_idx").on(t.syllabusWeekId)],
);

/** Class 1 and Class 2 of a week. */
export const classSessions = pgTable(
  "class_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    syllabusWeekId: uuid("syllabus_week_id")
      .notNull()
      .references(() => syllabusWeeks.id, { onDelete: "cascade" }),
    classNumber: integer("class_number").notNull(), // 1 = input, 2 = output
    title: text("title").notNull(),
    planMd: text("plan_md"),
  },
  (t) => [unique("class_session_unique").on(t.syllabusWeekId, t.classNumber)],
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
 * Progress. One child, one level, one syllabus version, their own week pointer.
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
    currentWeek: integer("current_week").notNull().default(1),
    status: enrollmentStatus("status").notNull().default("active"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("enrollments_child_idx").on(t.childId),
    index("enrollments_status_idx").on(t.status),
  ],
);

/** Swap or add a single item for a single child's week. Escape hatch. */
export const enrollmentItemOverrides = pgTable("enrollment_item_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  syllabusWeekId: uuid("syllabus_week_id")
    .notNull()
    .references(() => syllabusWeeks.id, { onDelete: "cascade" }),
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
    syllabusWeekId: uuid("syllabus_week_id").references(() => syllabusWeeks.id, {
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
 * Keys on `wordKey` (the word itself, normalised) rather than a week-scoped id,
 * so a child's memory follows them across levels.
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
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export const writingSubmissions = pgTable(
  "writing_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    childId: uuid("child_id")
      .notNull()
      .references(() => childProfiles.id, { onDelete: "cascade" }),
    writingTaskId: uuid("writing_task_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "restrict" }),
    body: text("body"),
    /** Private R2 object — may show the child's handwriting. Signed URLs only. */
    photoUrl: text("photo_url"),
    planningNotes: jsonb("planning_notes").notNull().default({}),
    status: writingStatus("status").notNull().default("submitted"),
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
    index("writing_submissions_status_idx").on(t.status),
    index("writing_submissions_child_idx").on(t.childId),
  ],
);

export const parentNotes = pgTable("parent_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id")
    .notNull()
    .references(() => childProfiles.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
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
