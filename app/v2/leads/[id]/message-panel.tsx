"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Message, Channel } from "@/lib/types";
import { CHANNEL_LABELS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Copy,
    Check,
    RefreshCw,
    Send,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Clock,
    Mail,
    MessageCircle,
} from "lucide-react";

interface MessagePanelProps {
    leadId: string;
    currentUserId: string;
    leadName: string;
}

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
    { value: "email", label: "Email" },
    { value: "instagram", label: "Instagram DM" },
    { value: "facebook", label: "Facebook DM" },
    { value: "linkedin", label: "LinkedIn DM" },
];

const STATUS_STYLES: Record<string, string> = {
    draft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    sent: "bg-primary/10 text-primary border-primary/20",
    replied: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export function MessagePanel({ leadId, currentUserId, leadName }: MessagePanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [channel, setChannel] = useState("email");
    const [direction, setDirection] = useState("");
    const [showDirection, setShowDirection] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [sendNote, setSendNote] = useState("");
    const [showSendNote, setShowSendNote] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        fetchMessages();
    }, [leadId]);

    async function fetchMessages() {
        setLoading(true);
        const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false });

        setMessages((data ?? []) as Message[]);
        setLoading(false);
    }

    async function handleGenerate(parentMessageId?: string) {
        setGenerating(true);
        setError(null);
        try {
            const res = await fetch("/api/generate-outreach", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leadId,
                    channel,
                    direction: direction || undefined,
                    parentMessageId,
                }),
            });

            if (res.ok) {
                setDirection("");
                setShowDirection(false);
                await fetchMessages();
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || `Generation failed (${res.status})`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
        } finally {
            setGenerating(false);
        }
    }

    async function handleCopy(text: string, id: string) {
        await navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    }

    async function handleMarkSent(messageId: string) {
        const now = new Date().toISOString();
        await supabase
            .from("messages")
            .update({
                status: "sent",
                sent_at: now,
                send_note: sendNote || null,
            })
            .eq("id", messageId);

        // Log activity
        const msg = messages.find((m) => m.id === messageId);
        if (msg) {
            const activityType =
                msg.channel === "email" ? "cold_email" : "social_dm";
            await supabase.from("activities").insert({
                lead_id: leadId,
                user_id: currentUserId,
                activity_type: activityType,
                channel: msg.channel,
                outcome: "sent",
                notes: sendNote || `Sent ${msg.channel} outreach`,
                is_private: false,
                occurred_at: now,
                message_id: messageId,
            });

            // Update lead last_contacted_at
            await supabase
                .from("leads")
                .update({ last_contacted_at: now })
                .eq("id", leadId);
        }

        setSendNote("");
        setShowSendNote(null);
        await fetchMessages();
        router.refresh();
    }

    // Group messages by version chain
    function getLatestVersions(): Message[] {
        const roots = messages.filter((m) => !m.parent_message_id);
        const children = messages.filter((m) => m.parent_message_id);

        return roots.map((root) => {
            const versions = children
                .filter((c) => c.parent_message_id === root.id)
                .sort((a, b) => b.version - a.version);
            return versions.length > 0 ? versions[0] : root;
        });
    }

    function getVersionHistory(messageId: string): Message[] {
        const msg = messages.find((m) => m.id === messageId);
        if (!msg) return [];

        const rootId = msg.parent_message_id || msg.id;
        return messages
            .filter((m) => m.id === rootId || m.parent_message_id === rootId)
            .sort((a, b) => b.version - a.version);
    }

    const latestMessages = getLatestVersions();

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Messages</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {messages.length} total
                </span>
            </div>

            {/* Generate Controls */}
            <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-secondary/20 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                        className="flex-1 rounded-lg border border-border/40 bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                        {CHANNEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <Button
                        onClick={() => handleGenerate()}
                        disabled={generating}
                        className="bg-primary hover:bg-primary/80 text-primary-foreground font-semibold shadow-[0_0_12px_rgba(34,197,94,0.3)] rounded-lg"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {generating ? "Generating..." : "Generate"}
                    </Button>
                </div>

                <button
                    onClick={() => setShowDirection(!showDirection)}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    {showDirection ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Add direction
                </button>

                {showDirection && (
                    <Textarea
                        value={direction}
                        onChange={(e) => setDirection(e.target.value)}
                        rows={2}
                        placeholder="e.g., Focus on their Instagram presence, use a question opener, mention their award..."
                        className="resize-none border-border/40 bg-secondary rounded-lg text-sm"
                    />
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Messages List */}
            {loading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Loading messages...</div>
            ) : latestMessages.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                    No messages yet. Generate one above.
                </div>
            ) : (
                <div className="space-y-4">
                    {latestMessages.map((msg) => {
                        const versions = getVersionHistory(msg.id);
                        const hasVersions = versions.length > 1;
                        const isExpanded = expandedId === msg.id;
                        const isSendNoteOpen = showSendNote === msg.id;
                        const fullBody = msg.subject
                            ? `Subject: ${msg.subject}\n\n${msg.body}`
                            : msg.body;

                        return (
                            <div
                                key={msg.id}
                                className="rounded-xl border border-border/40 bg-secondary/20 backdrop-blur-sm overflow-hidden"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-secondary/30">
                                    <div className="flex items-center gap-2">
                                        {msg.channel === "email" ? (
                                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                        ) : (
                                            <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                        )}
                                        <span className="text-xs font-semibold text-foreground">
                                            {CHANNEL_LABELS[msg.channel as Channel] || msg.channel}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] font-bold uppercase ${STATUS_STYLES[msg.status] || ""}`}
                                        >
                                            {msg.status}
                                        </Badge>
                                        {msg.version > 1 && (
                                            <span className="text-[10px] text-muted-foreground">
                                                v{msg.version}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        {new Date(msg.created_at).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "numeric",
                                            minute: "2-digit",
                                        })}
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="px-4 py-3">
                                    {msg.subject && (
                                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                                            Subject: {msg.subject}
                                        </p>
                                    )}
                                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                        {msg.body}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="px-4 py-3 border-t border-border/40 flex items-center gap-2 flex-wrap">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopy(fullBody, msg.id)}
                                        className="border-border/40 text-xs"
                                    >
                                        {copied === msg.id ? (
                                            <Check className="w-3.5 h-3.5 mr-1.5 text-primary" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                                        )}
                                        {copied === msg.id ? "Copied" : "Copy"}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleGenerate(msg.parent_message_id || msg.id)}
                                        disabled={generating}
                                        className="border-border/40 text-xs"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${generating ? "animate-spin" : ""}`} />
                                        Regenerate
                                    </Button>

                                    {msg.status === "draft" && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                isSendNoteOpen
                                                    ? handleMarkSent(msg.id)
                                                    : setShowSendNote(msg.id)
                                            }
                                            className="border-primary/20 text-primary bg-primary/10 hover:bg-primary/20 text-xs"
                                        >
                                            <Send className="w-3.5 h-3.5 mr-1.5" />
                                            {isSendNoteOpen ? "Confirm Sent" : "Mark Sent"}
                                        </Button>
                                    )}

                                    {hasVersions && (
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                                            className="ml-auto flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            {versions.length} versions
                                        </button>
                                    )}
                                </div>

                                {/* Send note input */}
                                {isSendNoteOpen && (
                                    <div className="px-4 pb-3">
                                        <input
                                            type="text"
                                            value={sendNote}
                                            onChange={(e) => setSendNote(e.target.value)}
                                            placeholder="Quick note (optional)..."
                                            className="w-full rounded-lg border border-border/40 bg-secondary px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                )}

                                {/* Version History */}
                                {isExpanded && (
                                    <div className="border-t border-border/40 bg-background/30">
                                        {versions.slice(1).map((v) => (
                                            <div key={v.id} className="px-4 py-3 border-b border-border/20 last:border-b-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-[10px] font-bold text-muted-foreground">
                                                        v{v.version}
                                                    </span>
                                                    {v.direction && (
                                                        <span className="text-[10px] text-muted-foreground/70 italic">
                                                            {v.direction}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                                        {new Date(v.created_at).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "numeric",
                                                            minute: "2-digit",
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                                                    {v.body}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
