import { useState, useEffect } from 'react';
import { FormattedLogData } from '../lib/agentLogger';

interface AgentConfig {
  color: string;
  icon: string;
  name: string;
}

interface InteractionTypeConfig {
  icon: string;
  color: string;
  label: string;
}

export default function EnhancedLogViewer(): React.ReactElement {
  const [logs, setLogs] = useState<FormattedLogData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [filterAgent, setFilterAgent] = useState<string>('all');

  // Fetch logs from API
  const fetchLogs = async (): Promise<void> => {
    try {
      const response = await fetch('/api/logs');
      const data = await response.json();

      if (data.success) {
        setLogs(data.logs);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch logs');
      }
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to connect to API: ' + errorMessage);
      setLoading(false);
    }
  };

  // Set up polling for real-time updates
  useEffect(() => {
    fetchLogs(); // Initial fetch

    const interval = setInterval(() => {
      if (isPolling) {
        fetchLogs();
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [isPolling]);

  const toggleLogExpansion = (index: number): void => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getAgentConfig = (agentName: string): AgentConfig => {
    const configs: Record<string, AgentConfig> = {
      EventDetectionAgent: {
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: '🔍',
        name: 'Event Detection'
      },
      DateAssignmentAgent: {
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '📅',
        name: 'Date Assignment'
      },
      RelationshipAssignmentAgent: {
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: '🔗',
        name: 'Relationship Analysis'
      }
    };
    return configs[agentName] || {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: '🤖',
      name: agentName || 'Unknown Agent'
    };
  };

  const getInteractionType = (interactionType: string): InteractionTypeConfig => {
    return interactionType === 'prompt' ? {
      icon: '💬',
      color: 'bg-amber-50 border-l-amber-400',
      label: 'Prompt'
    } : {
      icon: '💡',
      color: 'bg-emerald-50 border-l-emerald-400',
      label: 'Response'
    };
  };

  const filteredLogs = logs.filter(log =>
    filterAgent === 'all' || log.agentName === filterAgent
  );

  const uniqueAgents = [...new Set(logs.map(log => log.agentName))];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading agent logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <div className="text-center">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <p className="text-red-800 mb-4">Error: {error}</p>
          <button
            onClick={fetchLogs}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Agent Interaction Logs</h3>
            <p className="text-gray-600">
              {filteredLogs.length} interactions • Real-time updates {isPolling ?
                <span className="text-green-600 font-medium">ON</span> :
                <span className="text-red-600 font-medium">OFF</span>
              }
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Agent Filter */}
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Agents</option>
              {uniqueAgents.map(agent => (
                <option key={agent} value={agent}>{getAgentConfig(agent).name}</option>
              ))}
            </select>

            <button
              onClick={() => setIsPolling(!isPolling)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isPolling
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-500 hover:bg-gray-600 text-white'
              }`}
            >
              {isPolling ? '⏸️ Pause' : '▶️ Resume'}
            </button>

            <button
              onClick={fetchLogs}
              className="btn-primary"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Logs Container */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {filteredLogs.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h4 className="text-xl font-semibold text-gray-700 mb-2">No agent interactions yet</h4>
            <p className="text-gray-500">Start processing to see real-time logs here</p>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const agentConfig = getAgentConfig(log.agentName);
            const interactionType = getInteractionType(log.interactionType);
            const isExpanded = expandedLogs.has(index);
            const shouldTruncate = log.content.length > 300;

            return (
              <div
                key={index}
                className={`agent-card ${interactionType.color} border-l-4`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{agentConfig.icon}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${agentConfig.color}`}>
                          {agentConfig.name}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.interactionType === 'prompt'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {interactionType.icon} {interactionType.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 font-mono">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>

                {/* Content */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-hidden">
                    {isExpanded || !shouldTruncate
                      ? log.content
                      : log.content.substring(0, 300) + '...'
                    }
                  </pre>

                  {shouldTruncate && (
                    <button
                      onClick={() => toggleLogExpansion(index)}
                      className="mt-2 text-primary-600 hover:text-primary-800 text-sm font-medium"
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>

                {/* Metadata */}
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Metadata:</p>
                    <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded font-mono">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {filteredLogs.length > 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">
            Showing {filteredLogs.length} of {logs.length} interactions
          </p>
        </div>
      )}
    </div>
  );
}