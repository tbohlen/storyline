import { useState, useEffect } from 'react';
import EnhancedLogViewer from '../components/EnhancedLogViewer';
import TimelineVisualization from '../components/TimelineVisualization';

interface ProcessingStatus {
  isProcessing?: boolean;
  progress?: number;
}

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>('checking...');
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  useEffect(() => {
    // Check API status
    fetch('/api/test')
      .then(res => res.json())
      .then(data => setApiStatus('✅ ' + data.message))
      .catch(() => setApiStatus('❌ API connection failed'));

    // Check processing status
    checkProcessingStatus();
  }, []);

  const checkProcessingStatus = async (): Promise<void> => {
    try {
      const response = await fetch('/api/process');
      const data = await response.json();
      setProcessingStatus(data.status);
    } catch (error) {
      console.error('Failed to check processing status:', error);
    }
  };

  const startProcessing = async (): Promise<void> => {
    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelFileName: 'sample_novel.txt', // placeholder
          novelNumber: 1,
          options: {
            maxChunks: 3,
            delayBetweenChunks: 1000
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        setProcessingStatus(data.status);
        setActiveTab('logs'); // Switch to logs tab
      } else {
        alert('Failed to start processing: ' + data.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Error starting processing: ' + errorMessage);
    }
  };

  const clearLogs = async (): Promise<void> => {
    try {
      const response = await fetch('/api/logs', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setLogs([]);
        alert('Logs cleared successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Failed to clear logs: ' + errorMessage);
    }
  };

  interface TabButtonProps {
    id: string;
    label: string;
    active: boolean;
    onClick: (id: string) => void;
  }

  const TabButton: React.FC<TabButtonProps> = ({ id, label, active, onClick }) => (
    <button
      onClick={() => onClick(id)}
      style={{
        padding: '0.5rem 1rem',
        margin: '0 0.25rem',
        backgroundColor: active ? '#007acc' : '#f5f5f5',
        color: active ? 'white' : '#333',
        border: '1px solid #ddd',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Storyline Analysis Engine</h1>
      <p>Novel timeline analysis and event detection system</p>

      {/* Tab Navigation */}
      <div style={{ marginTop: '2rem', borderBottom: '1px solid #ddd', paddingBottom: '1rem' }}>
        <TabButton id="dashboard" label="Dashboard" active={activeTab === 'dashboard'} onClick={setActiveTab} />
        <TabButton id="logs" label="Agent Logs" active={activeTab === 'logs'} onClick={setActiveTab} />
        <TabButton id="timeline" label="Timeline" active={activeTab === 'timeline'} onClick={setActiveTab} />
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div>
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px'
          }}>
            <h3>System Status</h3>
            <p>API: {apiStatus}</p>
            <p>Processing: {processingStatus?.isProcessing ?
              `🔄 Running (${processingStatus.progress}%)` :
              '⏸️ Idle'
            }</p>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3>Actions</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={startProcessing}
                disabled={processingStatus?.isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: processingStatus?.isProcessing ? '#ccc' : '#007acc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: processingStatus?.isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                {processingStatus?.isProcessing ? 'Processing...' : 'Start Demo Processing'}
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                View Agent Logs
              </button>

              <button
                onClick={clearLogs}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Clear Logs
              </button>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3>Features</h3>
            <ul>
              <li>✅ AI-powered event detection</li>
              <li>✅ Temporal relationship analysis</li>
              <li>✅ Real-time agent interaction logs</li>
              <li>✅ Neo4j graph database integration</li>
              <li>⏳ Upload and process novel files (.docx)</li>
              <li>⏳ Timeline visualization</li>
            </ul>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div style={{ marginTop: '2rem' }}>
          <EnhancedLogViewer />
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div style={{ marginTop: '2rem' }}>
          <TimelineVisualization />
        </div>
      )}
    </div>
  );
}