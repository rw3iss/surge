export type FormStatus = 'draft' | 'published' | 'closed' | 'archived';

export type QuestionType =
    | 'radio'
    | 'checkbox'
    | 'text'
    | 'textarea'
    | 'select'
    | 'number'
    | 'email'
    | 'date';

export interface FormQuestion {
    id: string;
    formId: string;
    type: QuestionType;
    question: string;
    description?: string;
    options?: string[];
    isRequired: boolean;
    order: number;
    validation?: QuestionValidation;
    createdAt: Date;
    updatedAt: Date;
}

export interface QuestionValidation {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    patternMessage?: string;
}

/** What happens when a form is submitted. Exactly one per form. */
export type FormActionType = 'submit' | 'subscribe' | 'email';

/** Action-specific settings, stored as JSON on the form. Only the keys relevant
 *  to the selected `action` are used. */
export interface FormActionConfig {
    /** `subscribe`: mailing list to add the submitter to. */
    mailingListId?: string;
    /** `email`: recipient address. May contain `{{ … }}` (e.g. `{{email}}`). */
    emailTo?: string;
    /** `email`: subject line. Templated. */
    emailSubject?: string;
    /** `email`: HTML body (rich text). Templated; submitted values are escaped. */
    emailBody?: string;
}

export interface Form {
    id: string;
    title: string;
    slug: string;
    description?: string;
    status: FormStatus;
    showResults: boolean;
    allowMultipleSubmissions: boolean;
    requiresAuth: boolean;
    successMessage?: string;
    /** On-submit action (default `submit` = save only). */
    action: FormActionType;
    /** Settings for the selected action. */
    actionConfig?: FormActionConfig;
    /** Hard cap on total submissions; null/undefined = unlimited. */
    maxSubmissions?: number | null;
    questions: FormQuestion[];
    submissionCount: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;
}

export interface FormSubmission {
    id: string;
    formId: string;
    userId?: string;
    ipAddress: string;
    userAgent?: string;
    answers: FormAnswer[];
    submittedAt: Date;
}

export interface FormAnswer {
    questionId: string;
    value: string | string[] | number | boolean;
}

export interface FormResults {
    formId: string;
    totalSubmissions: number;
    questionResults: QuestionResult[];
}

export interface QuestionResult {
    questionId: string;
    question: string;
    type: QuestionType;
    responses: number;
    summary: QuestionSummary;
}

export type QuestionSummary =
    | ChoiceSummary
    | TextSummary
    | NumberSummary;

export interface ChoiceSummary {
    type: 'choice';
    options: Array<{
        value: string;
        count: number;
        percentage: number;
    }>;
}

export interface TextSummary {
    type: 'text';
    sampleResponses: string[];
    totalResponses: number;
}

export interface NumberSummary {
    type: 'number';
    min: number;
    max: number;
    average: number;
    median: number;
}
