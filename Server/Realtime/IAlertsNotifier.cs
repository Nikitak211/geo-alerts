using System.Threading.Tasks;

namespace Server.Realtime;

public interface IAlertsNotifier
{
    Task BroadcastAsync(object message);

    Task InferenceResultAsync(object payload);
}

