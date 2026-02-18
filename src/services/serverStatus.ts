import { Server, ConnectionStatus } from '../types';
import { OpenCodeService } from './opencode';

export async function checkServerHealth(server: Server): Promise<ConnectionStatus> {
  const service = new OpenCodeService(server);
  const isHealthy = await service.healthCheck();
  return isHealthy ? 'connected' : 'disconnected';
}