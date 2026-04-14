'use client';

import { Suspense, useState, useEffect } from 'react';
import { getFeedbackItems, setFeedbackItems, clearFeedbackItems } from '@/components/FeedbackButton';
import type { FeedbackItem } from '@/components/FeedbackButton';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';

function FeedbackContent() {
  const [items, setItemsState] = useState<FeedbackItem[]>(() => getFeedbackItems());
  const [comment, setComment] = useState('');

  useEffect(() => {
    const sync = () => setItemsState(getFeedbackItems());
    window.addEventListener('feedback-updated', sync);
    return () => window.removeEventListener('feedback-updated', sync);
  }, []);

  const removeItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItemsState(updated);
    setFeedbackItems(updated);
  };

  const handleSubmit = () => {
    const locationInfo = items.length > 0
      ? (items[0].locationName ?? `${items[0].lat.toFixed(4)}, ${items[0].lng.toFixed(4)}`)
      : 'Unknown';

    const title = items.length > 0
      ? `Feedback: ${locationInfo} (${items.length} data point${items.length !== 1 ? 's' : ''})`
      : 'Feedback';

    const bodyParts: string[] = [];

    if (comment.trim()) {
      bodyParts.push(`## Description\n\n${comment.trim()}\n`);
    }

    if (items.length > 0) {
      const coords = `${items[0].lat.toFixed(4)}, ${items[0].lng.toFixed(4)}`;
      bodyParts.push(`## Selected Data Points\n`);
      bodyParts.push(`**Location:** ${locationInfo} (${coords})\n`);
      for (const item of items) {
        bodyParts.push(`- **[${item.page}]** ${item.time} — ${item.summary}`);
      }
    }

    const body = bodyParts.join('\n');
    const params = new URLSearchParams({ title, body, labels: 'feedback' });
    const url = `https://github.com/ChrVage/NoFish/issues/new?${params.toString()}`;

    window.open(url, '_blank');
  };

  const handleClear = () => {
    clearFeedbackItems();
    setItemsState([]);
  };

  return (
    <div className="min-h-screen bg-ocean-50">
      <Header>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
          </div>
        </div>
      </Header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg" style={{ padding: '2rem 1.5rem' }}>
          <h2 className="text-2xl font-bold text-ocean-900 mb-1">Submit Feedback</h2>
          <p className="text-sm text-gray-500 mb-6">
            Report inaccurate data or suggest improvements. Your feedback will be submitted as a GitHub issue.
          </p>

          {items.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-700 mb-2">
                Flagged data points ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-start gap-2 bg-gray-50 rounded p-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-ocean-700">[{item.page}]</span>{' '}
                      <span className="text-gray-600">{item.time}</span>
                      <br />
                      <span className="text-gray-500">{item.summary}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-gray-400 hover:text-red-500"
                      title="Remove"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px', flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6 text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-400">No data points flagged.</p>
              <p className="text-xs text-gray-400 mt-1">
                Use the flag icon on score, tide, or detail rows to flag specific data points.
              </p>
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="feedback-comment" className="block text-sm font-bold text-gray-700 mb-2">
              Your feedback <span className="text-red-500">*</span>
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Describe what looks wrong or your suggestion..."
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                resize: 'vertical',
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!comment.trim()}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: comment.trim() ? '#2563eb' : '#d1d5db',
                color: comment.trim() ? '#fff' : '#9ca3af',
                fontWeight: 700,
                fontSize: '14px',
                cursor: comment.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Submit on GitHub →
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#fff',
                  color: '#6b7280',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Clear all
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-4">
            This will open GitHub in a new tab with a pre-filled issue. You&apos;ll need a GitHub account to submit.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense>
      <FeedbackContent />
    </Suspense>
  );
}
