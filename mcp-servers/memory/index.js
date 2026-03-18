#!/usr/bin/env node
/**
 * Venture OS — Cross-workspace Memory MCP Server
 *
 * Stores and retrieves memories across all project workspaces (venture-os,
 * lool-ai, freelance-system, etc.) using Supabase + pgvector.
 *
 * Two modes:
 *   - Full-text search (default) — works with just SUPABASE_* env vars
 *   - Semantic vector search — enabled automatically if VOYAGE_API_KEY is set
 *
 * Tools exposed:
 *   remember(content, workspace, project?, type?, metadata?)
 *   recall(query, workspace?, project?, type?, limit?)
 *   list_recent(workspace?, project?, limit?)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const VOYAGE_KEY = process.env.VOYAGE_API_KEY
const VECTOR_DIMS = 512 // voyage-3-lite dimensions

async function generateEmbedding(text) {
  if (!VOYAGE_KEY) return null
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'voyage-3-lite', input: [text] })
  })
  const data = await res.json()
  return data.data?.[0]?.embedding ?? null
}

const server = new Server(
  { name: 'venture-os-memory', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'remember',
      description: 'Store a memory — session summary, decision, learning, or outcome — tagged with workspace and project so any future chat can retrieve it.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The memory content to store' },
          workspace: { type: 'string', description: 'Workspace name: venture-os | lool-ai | freelance-system | espacio-bosques' },
          project: { type: 'string', description: 'Project name if different from workspace (optional)' },
          type: {
            type: 'string',
            enum: ['session', 'decision', 'learning', 'outcome'],
            description: 'session=conversation summary, decision=architectural/business choice, learning=what worked/failed, outcome=proposal result or metric',
            default: 'session'
          },
          metadata: { type: 'object', description: 'Any extra structured data (e.g. { "won": true, "client": "Óptica Roma" })' }
        },
        required: ['content', 'workspace']
      }
    },
    {
      name: 'recall',
      description: 'Search memories across ALL workspaces and projects. Use at the start of every session to load relevant context.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for' },
          workspace: { type: 'string', description: 'Limit to a specific workspace (optional)' },
          project: { type: 'string', description: 'Limit to a specific project (optional)' },
          type: { type: 'string', description: 'Limit to a memory type (optional)' },
          limit: { type: 'number', default: 8, description: 'Number of results (default 8)' }
        },
        required: ['query']
      }
    },
    {
      name: 'list_recent',
      description: 'List the most recent memories, optionally filtered by workspace or project.',
      inputSchema: {
        type: 'object',
        properties: {
          workspace: { type: 'string' },
          project: { type: 'string' },
          limit: { type: 'number', default: 10 }
        }
      }
    }
  ]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'remember') {
    const { content, workspace, project = null, type = 'session', metadata = {} } = args
    const embedding = await generateEmbedding(content)

    const { data, error } = await supabase
      .from('memories')
      .insert({ content, workspace, project, type, metadata, embedding })
      .select('id')
      .single()

    if (error) throw new Error(`Supabase insert error: ${error.message}`)

    const mode = embedding ? 'semantic' : 'text-search'
    return { content: [{ type: 'text', text: `Memory stored [${mode}]: ${data.id}` }] }
  }

  if (name === 'recall') {
    const { query, workspace, project, type, limit = 8 } = args

    // Semantic search if embeddings are available
    if (VOYAGE_KEY) {
      const embedding = await generateEmbedding(query)
      if (embedding) {
        const { data, error } = await supabase.rpc('search_memories', {
          query_embedding: embedding,
          filter_workspace: workspace ?? null,
          filter_project: project ?? null,
          filter_type: type ?? null,
          match_count: limit
        })
        if (!error && data?.length) {
          return { content: [{ type: 'text', text: formatResults(data) }] }
        }
      }
    }

    // Fall back to full-text search
    let q = supabase
      .from('memories')
      .select('id, workspace, project, type, content, created_at, metadata')
      .textSearch('content_tsv', query, { type: 'websearch', config: 'english' })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (workspace) q = q.eq('workspace', workspace)
    if (project) q = q.eq('project', project)
    if (type) q = q.eq('type', type)

    const { data, error } = await q
    if (error) throw new Error(`Supabase search error: ${error.message}`)

    return { content: [{ type: 'text', text: formatResults(data) }] }
  }

  if (name === 'list_recent') {
    const { workspace, project, limit = 10 } = args

    let q = supabase
      .from('memories')
      .select('id, workspace, project, type, content, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (workspace) q = q.eq('workspace', workspace)
    if (project) q = q.eq('project', project)

    const { data, error } = await q
    if (error) throw new Error(`Supabase list error: ${error.message}`)

    return { content: [{ type: 'text', text: formatResults(data) }] }
  }

  throw new Error(`Unknown tool: ${name}`)
})

function formatResults(rows) {
  if (!rows?.length) return 'No memories found.'
  return rows.map(m => {
    const date = m.created_at?.split('T')[0] ?? '?'
    const loc = `${m.workspace}${m.project && m.project !== m.workspace ? '/' + m.project : ''}`
    const preview = m.content.length > 400 ? m.content.substring(0, 400) + '…' : m.content
    return `[${date}] [${loc}] [${m.type}]\n${preview}`
  }).join('\n\n---\n\n')
}

const transport = new StdioServerTransport()
await server.connect(transport)
