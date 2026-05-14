"use client";

import { useState } from "react";
import type { Profile } from "@/lib/claude";

interface ScriptReviewProps {
  script: string;
  profile: Profile;
  sources?: string[];
  onEdit: (script: string) => void;
  onRender: () => void;
}

export function ScriptReview({
  script,
  profile,
  sources,
  onEdit,
  onRender,
}: ScriptReviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState(script);

  const wordCount = editedScript.trim().split(/\s+/).length;
  const wordCountColor =
    wordCount > 200
      ? "text-red-600"
      : wordCount > 180
        ? "text-amber-600"
        : "text-neutral-400";

  function handleSaveEdit() {
    onEdit(editedScript);
    setIsEditing(false);
  }

  function handleRender() {
    if (isEditing) {
      onEdit(editedScript);
    }
    onRender();
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-[600px] space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-tight">
            Script ready
          </h1>
          <p className="text-sm text-neutral-500">
            Review before rendering — for {profile.name}
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
          {isEditing ? (
            <textarea
              value={editedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              rows={8}
              className="w-full text-sm leading-relaxed resize-none focus:outline-none"
              aria-label="Edit video script"
            />
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {editedScript}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
            <span className={`text-xs ${wordCountColor}`}>
              {wordCount} words
            </span>
            {sources && sources.length > 0 && (
              <span className="text-xs text-neutral-400">
                Based on:{" "}
                {sources.map((s) => new URL(s).hostname).join(" · ")}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {isEditing ? (
            <button
              onClick={handleSaveEdit}
              className="flex-1 rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Done editing
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Edit script
            </button>
          )}
          <button
            onClick={handleRender}
            className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Render video →
          </button>
        </div>
      </div>
    </main>
  );
}
