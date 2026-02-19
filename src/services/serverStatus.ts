import { Server, ConnectionStatus } from '../types';
import { OpenCodeService } from './opencode';

export interface HealthCheckResult {
  status: ConnectionStatus;
  latencyMs: number;
  httpCode?: number;
  errorType?: 'network' | 'auth' | 'timeout' | 'server' | 'unknown';
  errorMessage?: string;
  requestUrl?: string;
  requestMethod?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

export async function checkServerHealth(server: Server): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const service = new OpenCodeService(server);
  
  try {
    const response = await service.healthCheckWithDetails();
    const latencyMs = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: 'connected',
        latencyMs,
        requestUrl: response.requestUrl,
        requestMethod: response.requestMethod,
        requestHeaders: response.requestHeaders,
        responseHeaders: response.responseHeaders,
        responseBody: response.responseBody,
      };
    } else {
      return {
        status: 'error',
        latencyMs,
        httpCode: response.status,
        errorType: response.status === 401 ? 'auth' : 'server',
        errorMessage: response.statusText,
        requestUrl: response.requestUrl,
        requestMethod: response.requestMethod,
        requestHeaders: response.requestHeaders,
        responseHeaders: response.responseHeaders,
        responseBody: response.responseBody,
      };
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return {
      status: 'error',
      latencyMs,
      errorType: error.name === 'AbortError' ? 'timeout' 
               : error.message?.toLowerCase().includes('network') ? 'network' 
               : 'unknown',
      errorMessage: error.message,
      requestUrl: error._requestUrl,
      requestMethod: error._requestMethod,
      requestHeaders: error._requestHeaders,
    };
  }
}