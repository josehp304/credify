'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType,
  Panel,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styles from './canvas.module.css';

// ──────────────────────────────────────────────
// Endpoint → human label map
// ──────────────────────────────────────────────
const ENDPOINT_META: Record<string, { label: string; color: string }> = {
  '/api/v1/refund/verify':        { label: 'Refund Request',      color: '#e4b363' },
  '/api/v1/review/score':         { label: 'Review Scored',       color: '#a394e0' },
  '/api/v1/document/verify':      { label: 'Document Verified',   color: '#3fcf9a' },
  '/api/v1/id/verify':            { label: 'ID Verification',     color: '#4fb2f5' },
  '/api/v1/extension/classify':   { label: 'Review Classified',   color: '#7f93ad' },
};

function getEndpointMeta(endpoint: string) {
  return ENDPOINT_META[endpoint] ?? { label: endpoint.split('/').pop() ?? 'Event', color: '#7f93ad' };
}

// ──────────────────────────────────────────────
// Custom Node: Trust Profile (User)
// ──────────────────────────────────────────────
function UserNode({ data }: { data: Record<string, unknown> }) {
  const score = data.trust_score as number;
  const scoreColor = score >= 80 ? '#3fcf9a' : score >= 50 ? '#e4b363' : '#f0716f';
  const initials = ((data.email as string | undefined) ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className={styles.userNode}>
      <Handle type="source" position={Position.Right} />
      <div className={styles.userAvatar} style={{ borderColor: scoreColor }}>
        {initials}
      </div>
      <div className={styles.userInfo}>
        <div className={styles.userEmail}>{(data.email as string) ?? (data.phone_number as string) ?? 'Unknown'}</div>
        <div className={styles.userMeta}>
          <span style={{ color: scoreColor }}>{score}</span>
          <span className={styles.pill}>{data.total_checks as number} checks</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Custom Node: Activity Log Event
// ──────────────────────────────────────────────
function EventNode({ data }: { data: Record<string, unknown> }) {
  const meta = getEndpointMeta(data.endpoint as string);
  const status = data.result_status as string;
  const statusColor = status === 'PASS' ? '#3fcf9a' : status === 'FAIL' ? '#f0716f' : '#e4b363';

  return (
    <div className={styles.eventNode}>
      <Handle type="target" position={Position.Left} />
      <div className={styles.eventHeader}>
        <span className={styles.eventDot} style={{ background: meta.color }} />
        <span className={styles.eventLabel}>{meta.label}</span>
      </div>
      <div className={styles.eventBody}>
        <span className={styles.statusBadge} style={{ color: statusColor, borderColor: statusColor + '55' }}>
          {status}
        </span>
        <span className={styles.eventDate}>
          {new Date(data.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

// Define outside component to avoid re-renders
const nodeTypes = { user: UserNode, event: EventNode };

// ──────────────────────────────────────────────
// Main Canvas Page
// ──────────────────────────────────────────────
interface TrustProfile {
  id: number;
  email: string | null;
  phone_number: string | null;
  trust_score: number;
  total_checks: number;
  prior_flags: number;
  created_at: string;
}

interface VerificationLog {
  id: number;
  endpoint: string;
  result_status: string;
  details: string | null;
  created_at: string;
}

export default function TrustCanvasPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, events: 0, pass: 0, fail: 0 });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  useEffect(() => {
    async function fetchAndBuild() {
      try {
        const res = await fetch(`/api/backend/trustcanvas`);
        const data = await res.json();

        if (!data.success) return;

        const profiles: TrustProfile[] = data.profiles ?? [];
        const logs: VerificationLog[] = data.logs ?? [];

        // ── Build nodes ──
        const builtNodes: Node[] = [];
        const builtEdges: Edge[] = [];

        // Map endpoint → logs for quick lookup
        const COLS = 4;
        const USER_X = 80;
        const EVENT_START_X = 360;
        const COL_GAP = 230;
        const ROW_GAP = 120;

        // Group logs by endpoint to spread them in columns
        const endpointGroups: Record<string, VerificationLog[]> = {};
        for (const log of logs) {
          if (!endpointGroups[log.endpoint]) endpointGroups[log.endpoint] = [];
          endpointGroups[log.endpoint].push(log);
        }

        // Place user nodes in Y rows
        profiles.forEach((profile, idx) => {
          builtNodes.push({
            id: `user-${profile.id}`,
            type: 'user',
            position: { x: USER_X, y: idx * ROW_GAP + 40 },
            data: { ...profile },
          });
        });

        // Place event nodes in the grid to the right
        let eventIndex = 0;
        for (const log of logs) {
          const col = eventIndex % COLS;
          const row = Math.floor(eventIndex / COLS);
          builtNodes.push({
            id: `event-${log.id}`,
            type: 'event',
            position: {
              x: EVENT_START_X + col * COL_GAP,
              y: row * (ROW_GAP * 0.85) + 40,
            },
            data: { ...log },
          });
          eventIndex++;
        }

        // ── Build edges: link profiles → logs by endpoint heuristic ──
        // Since logs don't store user IDs in this schema, we link the closest user
        // heuristically (profile with matching check count) or just cycle through profiles.
        const profileIds = profiles.map((p) => p.id);
        logs.forEach((log, idx) => {
          const profileId = profileIds[idx % Math.max(profileIds.length, 1)];
          const meta = getEndpointMeta(log.endpoint);
          if (profileId == null) return;
          builtEdges.push({
            id: `e-user${profileId}-event${log.id}`,
            source: `user-${profileId}`,
            target: `event-${log.id}`,
            animated: log.result_status === 'FAIL',
            style: { stroke: meta.color, strokeWidth: 1.5, opacity: 0.6 },
            markerEnd: { type: MarkerType.ArrowClosed, color: meta.color },
          });
        });

        setNodes(builtNodes);
        setEdges(builtEdges);
        setStats({
          users: profiles.length,
          events: logs.length,
          pass: logs.filter((l) => l.result_status === 'PASS').length,
          fail: logs.filter((l) => l.result_status === 'FAIL').length,
        });
      } catch (err) {
        console.error('Canvas fetch error', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAndBuild();
  }, [setNodes, setEdges]);

  const miniMapNodeColor = useCallback((node: { type?: string }) => {
    if (node.type === 'user') return '#4fb2f5';
    return '#25314a';
  }, []);

  return (
    <div className={styles.page}>
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <p>Building trust graph…</p>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background color="#1b2436" gap={24} size={1} />
        <Controls className={styles.controls} />
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="rgba(3, 7, 18, 0.85)"
          className={styles.minimap}
        />

        {/* Stats Panel */}
        <Panel position="top-left" className={styles.statsPanel}>
          <div className={styles.panelTitle}>Trust network</div>
          <div className={styles.statRow}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{stats.users}</span>
              <span className={styles.statLabel}>Users</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{stats.events}</span>
              <span className={styles.statLabel}>Events</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#3fcf9a' }}>{stats.pass}</span>
              <span className={styles.statLabel}>Pass</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#f0716f' }}>{stats.fail}</span>
              <span className={styles.statLabel}>Fail</span>
            </div>
          </div>
        </Panel>

        {/* Legend Panel */}
        <Panel position="top-right" className={styles.legendPanel}>
          <div className={styles.legendTitle}>Endpoints</div>
          {Object.entries(ENDPOINT_META).map(([, meta]) => (
            <div key={meta.label} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: meta.color }} />
              <span>{meta.label}</span>
            </div>
          ))}
        </Panel>
      </ReactFlow>
    </div>
  );
}
