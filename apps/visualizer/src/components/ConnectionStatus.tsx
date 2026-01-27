interface ConnectionStatusProps {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempt: number;
}

export default function ConnectionStatus({
  connected,
  reconnecting,
  reconnectAttempt,
}: ConnectionStatusProps) {
  return (
    <div className="bg-white/5 backdrop-blur-md p-3 rounded-lg border border-white/10 shadow-xl text-white overflow-y-auto">
      {connected ? (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <p className="text-xs font-semibold">Connected</p>
        </div>
      ) : reconnecting ? (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <p className="text-xs font-semibold">Reconnecting...</p>
          </div>
          <p className="text-xs text-gray-400">Attempt {reconnectAttempt}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <p className="text-xs">Disconnected</p>
        </div>
      )}
    </div>
  );
}
