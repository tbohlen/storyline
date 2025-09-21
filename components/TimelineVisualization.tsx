import { useState, useEffect } from 'react';

interface TimelineEvent {
  id: string;
  title: string;
  date: string | null;
  type: 'discovery' | 'social' | 'mystical' | 'conflict' | 'political';
  significance: 'high' | 'medium' | 'low';
  quote: string;
  relationships: string[];
}

export default function TimelineVisualization(): React.ReactElement {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // For now, create mock timeline data based on recent processing
    const mockEvents: TimelineEvent[] = [
      {
        id: 'event_1',
        title: 'Sir Galahad draws sword from stone',
        date: '1188-04-15',
        type: 'discovery',
        significance: 'high',
        quote: 'The ancient sword gleamed in the moonlight as Sir Galahad drew it from the stone.',
        relationships: ['before_coronation']
      },
      {
        id: 'event_2',
        title: 'The great feast',
        date: null,
        type: 'social',
        significance: 'medium',
        quote: 'During the feast that followed, the other knights marveled at the weapon\'s power.',
        relationships: ['after_sword_discovery']
      },
      {
        id: 'event_3',
        title: 'Prophecy fulfillment',
        date: null,
        type: 'mystical',
        significance: 'high',
        quote: 'Sir Galahad understood that the ancient prophecy was finally coming to pass.',
        relationships: ['connected_to_sword']
      }
    ];

    setTimeout(() => {
      setEvents(mockEvents);
      setLoading(false);
    }, 1000);
  }, []);

  const getEventColor = (type: TimelineEvent['type']): string => {
    const colors: Record<TimelineEvent['type'], string> = {
      discovery: 'bg-blue-500',
      social: 'bg-green-500',
      mystical: 'bg-purple-500',
      conflict: 'bg-red-500',
      political: 'bg-yellow-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getSignificanceSize = (significance: TimelineEvent['significance']): string => {
    const sizes: Record<TimelineEvent['significance'], string> = {
      high: 'w-6 h-6',
      medium: 'w-4 h-4',
      low: 'w-3 h-3'
    };
    return sizes[significance] || 'w-4 h-4';
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Generating timeline...</p>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-6xl mb-4">📅</div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">No Timeline Data</h3>
        <p className="text-gray-500 mb-6">
          Process a novel first to generate timeline events and relationships.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline Header */}
      <div className="card">
        <h3 className="text-xl font-bold mb-2">Event Timeline</h3>
        <p className="text-gray-600">
          Chronological visualization of events detected in the novel with their relationships
        </p>
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>

          {/* Events */}
          <div className="space-y-8">
            {events.map((event, index) => (
              <div key={event.id} className="relative flex items-start space-x-6">
                {/* Event marker */}
                <div className="relative z-10 flex items-center">
                  <div className={`${getEventColor(event.type)} ${getSignificanceSize(event.significance)} rounded-full border-4 border-white shadow-lg`}></div>
                </div>

                {/* Event content */}
                <div className="flex-1 bg-gray-50 rounded-lg p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                    <h4 className="font-bold text-gray-900">{event.title}</h4>
                    <div className="flex items-center space-x-2 mt-1 sm:mt-0">
                      {event.date && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                          📅 {event.date}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        event.significance === 'high' ? 'bg-red-100 text-red-800' :
                        event.significance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {event.significance} significance
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium text-white ${getEventColor(event.type)}`}>
                        {event.type}
                      </span>
                    </div>
                  </div>

                  <blockquote className="text-gray-700 italic mb-3 pl-4 border-l-2 border-gray-300">
                    "{event.quote}"
                  </blockquote>

                  {event.relationships && event.relationships.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Relationships:</p>
                      <div className="flex flex-wrap gap-1">
                        {event.relationships.map((rel, i) => (
                          <span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                            🔗 {rel.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <h4 className="font-bold mb-4">Legend</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Event Types:</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Discovery</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Social</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>Mystical</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Conflict</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Significance:</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gray-400 rounded-full"></div>
                <span>High importance</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                <span>Medium importance</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span>Low importance</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}