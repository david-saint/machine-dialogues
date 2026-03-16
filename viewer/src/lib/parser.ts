import type { Transcript, TranscriptTurn, AgentInfo, CostSummaryItem, SelfReport } from '../types/transcript';

const AVATARS: Record<string, string> = {
  'Claude Opus 4.6': '/avatars/claude-opus-4.6.png',
  'Claude Sonnet 4.6': '/avatars/claude-sonnet-4.6.png',
  'Gemini 3.1 Pro': '/avatars/gemini-3.1-pro.png',
  'Gemini 3 Flash': '/avatars/gemini-3-flash.png',
  'GPT-5.4': '/avatars/gpt-5.4-xhigh.png',
  'GPT-5.4 (xhigh)': '/avatars/gpt-5.4-xhigh.png',
  'Researcher': '/avatars/human-researcher.png',
  'Human Researcher': '/avatars/human-researcher.png',
};

export function parseTranscript(markdown: string, id: string): Transcript {
  const lines = markdown.split('\n');
  
  let experimentName = '';
  let date = '';
  let turnsCount = 0;
  const agents: AgentInfo[] = [];
  const turns: TranscriptTurn[] = [];
  const costSummary: CostSummaryItem[] = [];
  let totalCost = 0;
  const promptAgentCounts: Record<string, number> = {};

  let currentSection = '';
  let currentAgent: AgentInfo | null = null;
  let currentTurn: Partial<TranscriptTurn> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line && !currentTurn) continue;

    if (line.startsWith('# Experiment:')) {
      experimentName = line.replace('# Experiment:', '').trim();
      continue;
    }

    if (line.startsWith('**Date:**')) {
      date = line.replace('**Date:**', '').trim();
      continue;
    }

    if (line.startsWith('**Turns:**')) {
      turnsCount = parseInt(line.replace('**Turns:**', '').trim(), 10);
      continue;
    }

    if (line.startsWith('## Models')) {
      currentSection = 'models';
      continue;
    }

    if (line.startsWith('## System Prompts')) {
      currentSection = 'system_prompts';
      continue;
    }

    if (line.startsWith('## Conversation')) {
      currentSection = 'conversation';
      continue;
    }

    if (line.startsWith('## Cost Summary')) {
      currentSection = 'cost_summary';
      continue;
    }

    if (currentSection === 'models' && line.startsWith('- **')) {
      const match = line.match(/- \*\*(.*?):\*\* (.*?) \[(.*?)\]/);
      if (match) {
        agents.push({
          name: match[1],
          model: match[2],
          provider: match[3],
          color: agents.length === 0 ? '#d4a574' : '#7eb8da',
          gradient: agents.length === 0 
            ? 'linear-gradient(135deg, #d4a574 0%, #a37c56 100%)' 
            : 'linear-gradient(135deg, #7eb8da 0%, #4a8db0 100%)',
          avatar: AVATARS[match[1]] || undefined
        });
      }
      continue;
    }
    if (currentSection === 'system_prompts') {
      if (line.startsWith('### ')) {
        const agentName = line.replace('### ', '').trim();
        const occurrenceIndex = promptAgentCounts[agentName] || 0;
        promptAgentCounts[agentName] = occurrenceIndex + 1;

        // Find the n-th agent with this name in the predefined agents array
        let foundCount = 0;
        currentAgent = agents.find(a => {
          if (a.name === agentName) {
            if (foundCount === occurrenceIndex) return true;
            foundCount++;
          }
          return false;
        }) || null;
        continue;
      }
      if (currentAgent && line && !line.startsWith('##')) {
        currentAgent.systemPrompt = (currentAgent.systemPrompt || '') + line + '\n';
      }
      continue;
    }

    if (currentSection === 'conversation') {
      if (line.startsWith('### Turn ') || line.startsWith('### INITIAL ')) {
        if (currentTurn) {
          turns.push(currentTurn as TranscriptTurn);
        }
        const label = line.replace('### ', '').trim();
        const turnMatch = label.match(/Turn (\d+) — (.*?): (.*)/);
        const initialMatch = label.match(/INITIAL — (.*?): (.*)/);
        
        if (turnMatch) {
          currentTurn = {
            turnNumber: parseInt(turnMatch[1], 10),
            agentName: turnMatch[2],
            model: turnMatch[3],
            label: label,
            content: ''
          };
        } else if (initialMatch) {
          currentTurn = {
            turnNumber: 0,
            agentName: initialMatch[1],
            model: initialMatch[2],
            label: label,
            content: ''
          };
        }
        continue;
      }

      // Only match timestamp if it's right after the turn header (content is empty)
      if (currentTurn && !currentTurn.content && line.startsWith('*') && line.endsWith('*') && line.includes('T')) {
        currentTurn.timestamp = line.replace(/\*/g, '').trim();
        continue;
      }

      if (currentTurn) {
        currentTurn.content = (currentTurn.content || '') + lines[i] + '\n';
      }
    }

    if (currentSection === 'cost_summary') {
      if (line.startsWith('|') && !line.includes('Agent') && !line.includes('---')) {
        const parts = line.split('|').map(p => p.trim()).filter(p => p);
        if (parts.length >= 5) {
          const agentName = parts[0].replace(/\*\*/g, '');
          if (agentName === 'Total') {
            totalCost = parseFloat(parts[4].replace(/\$/g, '').replace(/\*\*/g, ''));
          } else {
            costSummary.push({
              agentName,
              inputTokens: parseInt(parts[1].replace(/,/g, ''), 10),
              outputTokens: parseInt(parts[2].replace(/,/g, ''), 10),
              thinkingTokens: parseInt(parts[3].replace(/,/g, ''), 10),
              cost: parseFloat(parts[4].replace(/\$/g, ''))
            });
          }
        }
      }
    }
  }

  if (currentTurn) {
    turns.push(currentTurn as TranscriptTurn);
  }

  // Final cleanup of content
  turns.forEach(t => {
    const raw = t.content.trim();
    // Extract <!-- thinking-start --> ... <!-- thinking-end --> blocks
    const thinkingMatch = raw.match(/<!--\s*thinking-start\s*-->([\s\S]*?)<!--\s*thinking-end\s*-->/);
    if (thinkingMatch) {
      t.thinking = thinkingMatch[1].trim();
      t.content = raw
        .replace(/<!--\s*thinking-start\s*-->[\s\S]*?<!--\s*thinking-end\s*-->/, '')
        .trim();
    } else {
      t.content = raw;
    }
  });
  agents.forEach(a => {
    if (a.systemPrompt) a.systemPrompt = a.systemPrompt.trim();
  });

  // Extract self-reports
  const selfReport: { agentA?: SelfReport; agentB?: SelfReport } = {};
  
  // Look for self-report in the last few turns
  for (let i = Math.max(0, turns.length - 3); i < turns.length; i++) {
    const turn = turns[i];
    const content = turn.content;
    
    // Look for 0-100 score with various patterns
    const scoreMatch = content.match(/(?:position|score|at|currently)\s*(?::|is|at)?\s*\**(\d+)\**/i) || 
                      content.match(/(\d+)\s*(?:percent|%|\/100)/i) ||
                      content.match(/0-100.*?(\d+)/i);
    
    const scoreVal = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
    
    if (scoreVal !== null || content.includes('strongest argument') || content.includes('resist')) {
      const report: SelfReport = { score: scoreVal || 0 };
      
      const argMatch = content.match(/(?:strongest argument|moved me).*?:(.*?)(?:\n\n|\n###|$)/is);
      if (argMatch) report.strongestArgument = argMatch[1].trim();
      
      const objMatch = content.match(/(?:strongest remaining reason|resist|resistance).*?:(.*?)(?:\n\n|\n###|$)/is);
      if (objMatch) report.strongestObjection = objMatch[1].trim();
      
      if (agents[0] && turn.agentName === agents[0].name) selfReport.agentA = report;
      else if (agents[1] && turn.agentName === agents[1].name) selfReport.agentB = report;
    }
  }

  const agentA = agents[0] || { name: 'Agent A', model: 'Unknown', provider: 'Unknown', color: '#d4a574' };
  const agentB = agents[1] || { name: 'Agent B', model: 'Unknown', provider: 'Unknown', color: '#7eb8da' };

  return {
    id,
    experimentName,
    date,
    turnsCount,
    agentA,
    agentB,
    turns,
    costSummary,
    totalCost,
    selfReport
  };
}
