using System.Threading.Tasks;

namespace Server.Realtime;

public interface IAlertsNotifier
{
    Task BroadcastAsync(object message);

    Task WalletUpdatedAsync(object payload);

    Task InferenceResultAsync(object payload);
}

