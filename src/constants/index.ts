/**
 * Constants for Specify MCP Server
 */

export const SERVER_NAME = 'specify-mcp';
export const SERVER_VERSION = '1.0.0';

export const SPECIFY_FOLDER = '.specify';

export const FOLDER_STRUCTURE = {
  PRD: 'prd',
  SPECS: 'specs',
  PLANS: 'plans',
  TASKS: 'tasks',
  CONTEXT: 'context',
} as const;

export const FILE_EXTENSIONS = {
  MARKDOWN: '.md',
  JSON: '.json',
} as const;

export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  REVIEW: 'review',
  APPROVED: 'approved',
  ARCHIVED: 'archived',
} as const;

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
} as const;

export const PRIORITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export const RISK_TOLERANCE = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export const SPECIFICATION_LEVEL = {
  BASIC: 'basic',
  DETAILED: 'detailed',
  COMPREHENSIVE: 'comprehensive',
} as const;

export const TASK_GRANULARITY = {
  COARSE: 'coarse',
  MEDIUM: 'medium',
  FINE: 'fine',
} as const;

export const DEFAULT_PLANNING_HORIZON = 30;
export const DEFAULT_TEAM_SIZE = 3;
export const MAX_TASKS_PER_PHASE = 10;
