// Suggestions board data — the read/vote side of the feedback system. Idea-kind
// feedback is a PUBLIC, votable roadmap (see supabase/schema.sql): anyone can
// list ideas; signed-in users cast one upvote each, and the tally (feedback.votes,
// kept by a trigger) decides what gets built. All calls degrade to no-ops/empties
// when offline so the board just shows an offline note instead of erroring.

import { supabase, online } from './supabase.js';

// top ideas, most-voted first (only the public-safe columns)
export async function listIdeas(limit = 60) {
  if (!online) return [];
  const { data, error } = await supabase
    .from('feedback')
    .select('id, message, handle, votes, status, created_at')
    .eq('kind', 'idea')
    .order('votes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.warn('[brig] listIdeas failed', error); return []; }
  return data || [];
}

// the set of idea ids THIS user has already voted for (to show their state)
export async function myVotes(userId) {
  if (!online || !userId) return new Set();
  const { data, error } = await supabase.from('feedback_votes').select('feedback_id').eq('user_id', userId);
  if (error) { console.warn('[brig] myVotes failed', error); return new Set(); }
  return new Set((data || []).map((r) => r.feedback_id));
}

// all feedback (bugs + ideas) — admin only; anon/non-admin gets RLS-blocked empty array
export async function listAllFeedback(limit = 120) {
  if (!online) return [];
  const { data, error } = await supabase
    .from('feedback')
    .select('id, kind, message, handle, context, status, votes, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.warn('[brig] listAllFeedback failed', error); return []; }
  return data || [];
}

// update the status of a feedback entry — admin only
export async function setFeedbackStatus(id, status) {
  if (!online) throw new Error('offline');
  const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
  if (error) throw error;
}

// toggle a vote; returns the new voted-state (true = now voted). Requires sign-in.
export async function toggleVote(feedbackId, userId, voted) {
  if (!online || !userId) throw new Error('sign in to vote');
  if (voted) {
    const { error } = await supabase.from('feedback_votes').delete().eq('feedback_id', feedbackId).eq('user_id', userId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from('feedback_votes').insert({ feedback_id: feedbackId, user_id: userId });
  if (error) throw error;
  return true;
}
