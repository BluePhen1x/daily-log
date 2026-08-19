export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogCard {
  id: string;
  user_id: string;
  card_name: string;
  currency: string;
  created_at: string;
}

export interface LogEntry {
  id: string;
  card_id: string;
  user_id: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface LogCardWithEntries extends LogCard {
  log_entries: LogEntry[];
}
