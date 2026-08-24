/** A named grouping of related tasks within a context. */
export interface Project {
  id: string;
  contextId: string;
  name: string;
  description?: string;
  archived: boolean;
}
