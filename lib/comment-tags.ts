export interface DefaultCommentTag {
  name: string;
  color: string;
  position: number;
}

export const DEFAULT_COMMENT_TAGS: DefaultCommentTag[] = [
  { name: 'Feedback', color: '#3B82F6', position: 0 },
  { name: 'Technical', color: '#EF4444', position: 1 },
  { name: 'Creative', color: '#8B5CF6', position: 2 },
  { name: 'Approved', color: '#22C55E', position: 3 },
  { name: 'Urgent', color: '#F59E0B', position: 4 },
];
