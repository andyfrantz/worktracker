/** Managed tag metadata within a context. */
export interface Tag {
  id: string;
  contextId: string;
  name: string;
  normalizedName: string;
  archived: boolean;
}

/** Many-to-many association between tasks and tags. */
export interface TaskTag {
  taskId: string;
  tagId: string;
}
