'use client';

import { useState } from 'react';

export function AgentConsole() {
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [selectedAgent, setSelectedAgent] = useState('backend');
  const [task, setTask] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const agents = [
    { id: 'backend', name: 'Backend Agent' },
    { id: 'frontend', name: 'Frontend Agent' },
    { id: 'database', name: 'Database Agent' },
    { id: 'devops', name: 'DevOps Agent' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          agent: selectedAgent,
          sessionId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResponse(data.response);
        setTask('');
      } else {
        setResponse(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      setResponse('Error communicating with agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Agent Teams Console</h2>
        <p className="text-gray-600 text-sm">Session: {sessionId}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Agent
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Task
          </label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Enter task for the agent..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition"
        >
          {loading ? 'Processing...' : 'Send Task'}
        </button>
      </form>

      {response && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Response:</h3>
          <div className="bg-gray-50 rounded p-3 max-h-96 overflow-y-auto">
            <p className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
              {response}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
