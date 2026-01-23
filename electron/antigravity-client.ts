import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as https from 'node:https';
import * as http from 'node:http';

const execAsync = promisify(exec);

interface UsageDetail {
  label: string;
  percentage: number;
  limit: string | number;
  used: string | number;
  resetTime?: string;
  displayReset?: string;
  timeRemainingMinutes?: number;
  totalDurationMinutes?: number;
}

type Platform = 'win32' | 'darwin' | 'linux';

interface ProcessInfo {
  pid: number;
  port: number;
  csrfToken: string;
  protocol: 'http' | 'https';
}

interface AntigravityModel {
  label?: string;
  modelOrAlias?: { model?: string };
  quotaInfo?: {
    remainingFraction?: number;
    resetTime?: string;
  };
}

interface AntigravityUserStatus {
  userStatus?: {
    cascadeModelConfigData?: {
      clientModelConfigs?: AntigravityModel[];
    };
  };
}

export interface AntigravityStatus {
  connected: boolean;
  details: UsageDetail[];
  usagePercent: number;
}

export interface SplitAntigravityStatus {
  gemini: AntigravityStatus;
  external: AntigravityStatus;
}

export class AntigravityClient {
  private processInfo: ProcessInfo | null = null;
  private processName: string;
  private platform: Platform;

  constructor() {
    this.platform = process.platform as Platform;
    const arch = process.arch === 'arm64' ? '_arm' : '_x64';

    switch (this.platform) {
      case 'win32':
        this.processName = `language_server_windows${arch}.exe`;
        break;
      case 'darwin':
        this.processName = `language_server_macos${arch}`;
        break;
      default:
        this.processName = `language_server_linux${arch}`;
    }
  }

  public async getStatus(): Promise<SplitAntigravityStatus> {
    console.log(
      '[Antigravity] Getting status, processInfo exists:',
      !!this.processInfo
    );
    if (!this.processInfo) {
      const connected = await this.connect();
      if (!connected) {
        console.log('[Antigravity] Status check failed - not connected');
        return {
          gemini: { connected: false, details: [], usagePercent: 0 },
          external: { connected: false, details: [], usagePercent: 0 },
        };
      }
    }

    try {
      console.log('[Antigravity] Fetching user status...');
      const status = await this.fetchUserStatus();
      const allPools = this.parseStatus(status);

      console.log(
        '[Antigravity] Total pools from parseStatus:',
        allPools.length
      );

      // We need to track which pool came from which original model label
      // since parseStatus now returns pool-aggregated data

      // First, get all raw models to preserve their pool IDs
      const rawModels =
        status.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];

      // Create a map of model label -> pool ID
      const modelToPool = new Map<string, string>();
      for (const m of rawModels) {
        if (m.label) {
          modelToPool.set(m.label, this.inferPoolId(m.label));
        }
      }

      // Now process all raw models with their pool information
      const modelsWithPool = rawModels
        .filter((m) => m.quotaInfo)
        .map((m) => {
          const label = m.label || 'Unknown Model';
          const remainingFraction = m.quotaInfo?.remainingFraction ?? 1;
          const percentage = Math.round((1 - remainingFraction) * 100);
          const poolId = modelToPool.get(label) || 'default-pool';

          let displayReset: string | undefined;
          let timeRemainingMinutes: number | undefined;
          let resetTime: string | undefined;

          if (m.quotaInfo?.resetTime) {
            resetTime = m.quotaInfo.resetTime;
            const resetDate = new Date(m.quotaInfo.resetTime);
            if (
              !isNaN(resetDate.getTime()) &&
              resetDate.getTime() > Date.now()
            ) {
              const diff = resetDate.getTime() - Date.now();
              const totalMinutes = Math.round(diff / (1000 * 60));
              timeRemainingMinutes = totalMinutes;
              displayReset = this.formatTime(totalMinutes);
            }
          }

          return {
            label,
            percentage,
            poolId,
            displayReset,
            timeRemainingMinutes,
            resetTime,
          };
        });

      // Split into Gemini and External models
      const geminiModels = modelsWithPool.filter((m) =>
        m.poolId.includes('gemini')
      );
      const externalModels = modelsWithPool.filter(
        (m) => !m.poolId.includes('gemini')
      );

      console.log('[Antigravity] Gemini models:', geminiModels.length);
      console.log('[Antigravity] External models:', externalModels.length);

      // For Gemini: split into Pro, Flash, and other
      const geminiProModels = geminiModels.filter(
        (m) => m.poolId === 'gemini-pro-pool'
      );
      const geminiFlashModels = geminiModels.filter(
        (m) => m.poolId === 'gemini-flash-pool'
      );
      const otherGeminiModels = geminiModels.filter(
        (m) =>
          m.poolId !== 'gemini-pro-pool' && m.poolId !== 'gemini-flash-pool'
      );

      // Function to consolidate models into a single entry
      const consolidateDetails = (
        modelsToConsolidate: typeof modelsWithPool,
        label: string
      ): UsageDetail | null => {
        if (modelsToConsolidate.length === 0) {
          return null;
        }

        const maxPercentage = Math.max(
          ...modelsToConsolidate.map((m) => m.percentage),
          0
        );

        let earliestResetTime: string | undefined;
        let shortestTimeRemaining: number | undefined;
        let shortestDisplayReset: string | undefined;

        for (const model of modelsToConsolidate) {
          if (model.resetTime) {
            if (
              !earliestResetTime ||
              new Date(model.resetTime) < new Date(earliestResetTime)
            ) {
              earliestResetTime = model.resetTime;
              shortestTimeRemaining = model.timeRemainingMinutes;
              shortestDisplayReset = model.displayReset;
            }
          }
        }

        return {
          label,
          percentage: maxPercentage,
          limit: '',
          used: '',
          displayReset: shortestDisplayReset || 'Unavailable',
          timeRemainingMinutes: shortestTimeRemaining,
          resetTime: earliestResetTime,
        };
      };

      // Build Gemini details
      const geminiDetails: UsageDetail[] = [];

      const geminiProSummary = consolidateDetails(
        geminiProModels,
        'Gemini 3 Pro'
      );
      if (geminiProSummary) {
        geminiDetails.push(geminiProSummary);
      }

      const geminiFlashSummary = consolidateDetails(
        geminiFlashModels,
        'Gemini 3 Flash'
      );
      if (geminiFlashSummary) {
        geminiDetails.push(geminiFlashSummary);
      }

      if (otherGeminiModels.length > 0) {
        // Add other Gemini models individually
        geminiDetails.push(
          ...otherGeminiModels.map((m) => ({
            label: m.label,
            percentage: m.percentage,
            limit: '',
            used: '',
            displayReset: m.displayReset || 'Unavailable',
            timeRemainingMinutes: m.timeRemainingMinutes,
            resetTime: m.resetTime,
          }))
        );
      }

      // For External: consolidate all models into a single entry
      const externalDetailsSummary = consolidateDetails(
        externalModels,
        'External Models'
      );
      const externalDetails = externalDetailsSummary
        ? [externalDetailsSummary]
        : [];

      const geminiUsagePercent = Math.max(
        ...geminiDetails.map((d) => d.percentage),
        0
      );
      const externalUsagePercent = Math.max(
        ...externalDetails.map((d) => d.percentage),
        0
      );

      console.log(
        '[Antigravity] Gemini models:',
        geminiDetails.length,
        'usage:',
        geminiUsagePercent + '%'
      );
      console.log(
        '[Antigravity] External models:',
        externalDetails.length,
        'usage:',
        externalUsagePercent + '%'
      );

      return {
        gemini: {
          connected: geminiDetails.length > 0,
          details: geminiDetails,
          usagePercent: geminiUsagePercent,
        },
        external: {
          connected: externalDetails.length > 0,
          details: externalDetails,
          usagePercent: externalUsagePercent,
        },
      };
    } catch (error) {
      console.log('[Antigravity] Status fetch error:', error);
      this.processInfo = null;
      return {
        gemini: { connected: false, details: [], usagePercent: 0 },
        external: { connected: false, details: [], usagePercent: 0 },
      };
    }
  }

  private async connect(): Promise<boolean> {
    try {
      console.log('[Antigravity] Starting connection process...');
      const basicInfo = await this.findProcess();
      if (!basicInfo) {
        console.log('[Antigravity] Process not found');
        return false;
      }

      console.log('[Antigravity] Process found:', {
        pid: basicInfo.pid,
        port: basicInfo.port,
        csrfToken: basicInfo.csrfToken
          ? basicInfo.csrfToken.substring(0, 8) + '...'
          : 'EMPTY',
      });
      const ports = await this.getListeningPorts(basicInfo.pid);
      if (ports.length === 0) {
        console.log(
          '[Antigravity] No listening ports found for PID:',
          basicInfo.pid
        );
        return false;
      }

      console.log('[Antigravity] Listening ports:', ports);
      const workingPortInfo = await this.findWorkingPort(
        ports,
        basicInfo.csrfToken
      );
      if (!workingPortInfo) {
        console.log('[Antigravity] No working port found');
        return false;
      }

      console.log(
        '[Antigravity] Connected on port:',
        workingPortInfo.port,
        'Protocol:',
        workingPortInfo.protocol
      );
      this.processInfo = {
        ...basicInfo,
        port: workingPortInfo.port,
        protocol: workingPortInfo.protocol,
      };
      return true;
    } catch (error) {
      console.log('[Antigravity] Connect error:', error);
      return false;
    }
  }

  private async findProcess(): Promise<ProcessInfo | null> {
    switch (this.platform) {
      case 'win32':
        return this.findProcessWindows();
      case 'darwin':
        return this.findProcessMacOS();
      default:
        return this.findProcessLinux();
    }
  }

  private isAntigravityProcess(commandLine: string): boolean {
    const lowerCmd = commandLine.toLowerCase();

    if (/--app_data_dir\s+antigravity\b/i.test(commandLine)) {
      return true;
    }

    if (
      lowerCmd.includes('\\antigravity\\') ||
      lowerCmd.includes('/antigravity/')
    ) {
      return true;
    }

    return false;
  }

  private async findProcessWindows(): Promise<ProcessInfo | null> {
    try {
      console.log(
        '[Antigravity] Searching for Windows process:',
        this.processName
      );
      const cmd = `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${this.processName}*' } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"`;
      console.log('[Antigravity] Running PowerShell command');
      const { stdout } = await execAsync(cmd, { timeout: 10000 });
      console.log('[Antigravity] PowerShell output:', stdout);

      if (!stdout.trim()) {
        console.log('[Antigravity] No Windows process found (empty output)');
        return null;
      }

      let processes = JSON.parse(stdout);
      if (!Array.isArray(processes)) {
        processes = [processes];
      }

      const antigravityProcesses = processes.filter(
        (proc: { CommandLine?: string; ProcessId?: number }) =>
          proc.CommandLine && this.isAntigravityProcess(proc.CommandLine)
      );

      console.log(
        '[Antigravity] Found',
        antigravityProcesses.length,
        'Antigravity process(es)'
      );

      for (const proc of antigravityProcesses) {
        if (proc.CommandLine && proc.ProcessId) {
          const result = this.parseCommandLine(
            proc.ProcessId,
            proc.CommandLine
          );
          if (result) {
            return result;
          }
        }
      }

      console.log('[Antigravity] No matching Windows process found');
      return null;
    } catch (error) {
      console.log('[Antigravity] findProcessWindows error:', error);
      return null;
    }
  }

  private async findProcessMacOS(): Promise<ProcessInfo | null> {
    try {
      console.log(
        '[Antigravity] Searching for macOS process:',
        this.processName
      );
      const cmd = `ps aux | grep -v grep | grep '${this.processName}'`;
      console.log('[Antigravity] Running ps command:', cmd);
      const { stdout } = await execAsync(cmd, { timeout: 5000 });
      console.log('[Antigravity] ps output:', stdout);

      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes(this.processName)) {
          console.log('[Antigravity] Found process line:', line);
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 11) {
            const pid = parseInt(parts[1], 10);
            const cmdLine = parts.slice(10).join(' ');
            console.log(
              '[Antigravity] Extracted - PID:',
              pid,
              'CmdLine:',
              cmdLine
            );

            if (!this.isAntigravityProcess(cmdLine)) {
              console.log(
                '[Antigravity] Skipping non-Antigravity process (likely Codeium)'
              );
              continue;
            }

            const result = this.parseCommandLine(pid, cmdLine);
            if (result) {
              return result;
            }
          }
        }
      }

      console.log('[Antigravity] No matching macOS process found');
      return null;
    } catch (error) {
      console.log('[Antigravity] findProcessMacOS error:', error);
      return null;
    }
  }

  private async findProcessLinux(): Promise<ProcessInfo | null> {
    try {
      console.log(
        '[Antigravity] Searching for Linux process:',
        this.processName
      );
      const cmd = `pgrep -af ${this.processName}`;
      console.log('[Antigravity] Running command:', cmd);
      const { stdout } = await execAsync(cmd, { timeout: 5000 });
      console.log('[Antigravity] pgrep output:', stdout);

      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('--extension_server_port')) {
          console.log('[Antigravity] Found process line:', line);
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[0], 10);
          const cmdLine = line.substring(parts[0].length).trim();
          console.log(
            '[Antigravity] Extracted - PID:',
            pid,
            'CmdLine:',
            cmdLine
          );

          if (!this.isAntigravityProcess(cmdLine)) {
            console.log(
              '[Antigravity] Skipping non-Antigravity process (likely Codeium)'
            );
            continue;
          }

          const result = this.parseCommandLine(pid, cmdLine);
          if (result) {
            console.log('[Antigravity] Successfully parsed process info');
            return result;
          } else {
            console.log('[Antigravity] Failed to parse command line');
          }
        }
      }

      console.log('[Antigravity] No matching process found');
      return null;
    } catch (error) {
      console.log('[Antigravity] findProcessLinux error:', error);
      return null;
    }
  }

  private parseCommandLine(pid: number, cmdLine: string): ProcessInfo | null {
    console.log('[Antigravity] Parsing command line for PID:', pid);
    console.log('[Antigravity] Command line:', cmdLine);

    const portMatch = cmdLine.match(/--extension_server_port[=\s]+(\d+)/);
    const tokenMatch = cmdLine.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/);

    console.log(
      '[Antigravity] Port match:',
      portMatch ? portMatch[1] : 'NOT FOUND'
    );
    console.log(
      '[Antigravity] Token match:',
      tokenMatch ? tokenMatch[1].substring(0, 8) + '...' : 'NOT FOUND'
    );

    if (portMatch && portMatch[1]) {
      return {
        pid,
        port: parseInt(portMatch[1], 10),
        csrfToken: tokenMatch ? tokenMatch[1] : '',
        protocol: 'https',
      };
    }

    return null;
  }

  private inferPoolId(label: string): string {
    const lowerLabel = label.toLowerCase();

    if (lowerLabel.includes('claude')) {
      return 'claude-pool';
    }

    if (lowerLabel.includes('gemini') && lowerLabel.includes('pro')) {
      return 'gemini-pro-pool';
    }

    if (lowerLabel.includes('gemini') && lowerLabel.includes('flash')) {
      return 'gemini-flash-pool';
    }

    if (lowerLabel.includes('gpt')) {
      return 'claude-pool';
    }

    return 'default-pool';
  }

  private async getListeningPorts(pid: number): Promise<number[]> {
    switch (this.platform) {
      case 'win32':
        return this.getListeningPortsWindows(pid);
      case 'darwin':
        return this.getListeningPortsMacOS(pid);
      default:
        return this.getListeningPortsLinux(pid);
    }
  }

  private async getListeningPortsWindows(pid: number): Promise<number[]> {
    try {
      console.log(
        '[Antigravity] Getting listening ports for Windows PID:',
        pid
      );
      const cmd = `powershell.exe -NoProfile -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort | ConvertTo-Json -Compress"`;
      const { stdout } = await execAsync(cmd, { timeout: 10000 });
      console.log('[Antigravity] PowerShell port query output:', stdout);

      if (!stdout.trim()) {
        console.log(
          '[Antigravity] No listening ports found for Windows PID:',
          pid
        );
        return [];
      }

      let connections = JSON.parse(stdout);
      if (!Array.isArray(connections)) {
        connections = [connections];
      }

      const ports: number[] = connections
        .filter((c: { LocalPort?: number }) => c.LocalPort)
        .map((c: { LocalPort: number }) => c.LocalPort);

      const uniquePorts = Array.from(new Set<number>(ports));
      console.log('[Antigravity] Windows ports:', uniquePorts);
      return uniquePorts.sort((a, b) => a - b);
    } catch (error) {
      console.log('[Antigravity] getListeningPortsWindows error:', error);
      return [];
    }
  }

  private async getListeningPortsMacOS(pid: number): Promise<number[]> {
    try {
      console.log('[Antigravity] Getting listening ports for macOS PID:', pid);
      const cmd = `lsof -iTCP -sTCP:LISTEN -P -n -p ${pid} 2>/dev/null`;
      const { stdout } = await execAsync(cmd, { timeout: 5000 });
      console.log('[Antigravity] lsof output:', stdout);

      const ports: number[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        const match = line.match(/:(\d+)\s*(\(LISTEN\))?$/);
        if (match) {
          const port = parseInt(match[1], 10);
          if (!ports.includes(port)) {
            ports.push(port);
          }
        }
      }

      console.log('[Antigravity] macOS ports:', ports);
      return ports.sort((a, b) => a - b);
    } catch (error) {
      console.log('[Antigravity] getListeningPortsMacOS error:', error);
      return [];
    }
  }

  private async getListeningPortsLinux(pid: number): Promise<number[]> {
    const tryPattern = async (pattern: string): Promise<number[]> => {
      try {
        const cmd = `ss -tlnp 2>/dev/null | ${pattern}`;
        console.log('[Antigravity] Running ss command:', cmd);
        const { stdout } = await execAsync(cmd, { timeout: 5000 });
        console.log('[Antigravity] ss output:', stdout);

        const ports: number[] = [];
        const regex =
          /LISTEN\s+\d+\s+\d+\s+(?:\*|[\d.]+|\[[\da-f:]*\]):(\d+).*?pid=(\d+)/gi;

        let match;
        while ((match = regex.exec(stdout)) !== null) {
          const port = parseInt(match[1], 10);
          const matchedPid = parseInt(match[2], 10);
          console.log(
            '[Antigravity] Found port:',
            port,
            'for PID:',
            matchedPid
          );
          if (matchedPid === pid && !ports.includes(port)) {
            ports.push(port);
          }
        }

        console.log('[Antigravity] Final ports list:', ports);
        return ports.sort((a, b) => a - b);
      } catch (error) {
        console.log('[Antigravity] Pattern error:', error);
        return [];
      }
    };

    try {
      console.log('[Antigravity] Getting listening ports for PID:', pid);

      const patterns = [
        `grep "pid=${pid},"`,
        `grep "pid=${pid}"`,
        `grep "${pid}"`,
      ];

      for (const pattern of patterns) {
        const ports = await tryPattern(pattern);
        if (ports.length > 0) {
          return ports;
        }
      }

      console.log('[Antigravity] ss failed, trying lsof fallback');
      const lsofCmd = `lsof -p ${pid} -P -n -iTCP -sTCP:LISTEN 2>/dev/null`;
      console.log('[Antigravity] Running lsof command:', lsofCmd);
      const { stdout } = await execAsync(lsofCmd, { timeout: 5000 });
      console.log('[Antigravity] lsof output:', stdout);

      const ports: number[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        const match = line.match(/:(\d+)\s*\(LISTEN\)/);
        if (match) {
          const port = parseInt(match[1], 10);
          if (!ports.includes(port)) {
            ports.push(port);
          }
        }
      }

      console.log('[Antigravity] lsof ports:', ports);
      return ports.sort((a, b) => a - b);
    } catch (error) {
      console.log('[Antigravity] getListeningPortsLinux error:', error);
      return [];
    }
  }

  private async findWorkingPort(
    ports: number[],
    csrfToken: string
  ): Promise<{ port: number; protocol: 'http' | 'https' } | null> {
    for (const port of ports) {
      const protocol = await this.testPort(port, csrfToken);
      if (protocol) {
        return { port, protocol };
      }
    }
    return null;
  }

  private testPort(
    port: number,
    csrfToken: string
  ): Promise<'http' | 'https' | null> {
    return new Promise((resolve) => {
      const tokenDisplay = csrfToken
        ? csrfToken.substring(0, 8) + '...'
        : 'EMPTY';
      console.log(
        '[Antigravity] Testing port:',
        port,
        'with CSRF token:',
        tokenDisplay
      );
      const data = JSON.stringify({ wrapper_data: {} });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(data)),
        'Connect-Protocol-Version': '1',
      };

      if (csrfToken) {
        headers['X-Codeium-Csrf-Token'] = csrfToken;
      }

      const options: https.RequestOptions = {
        hostname: '127.0.0.1',
        port,
        path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
        method: 'POST',
        headers,
        rejectUnauthorized: false,
        timeout: 3000,
      };

      const req = https.request(options, (res) => {
        console.log(
          '[Antigravity] Port test HTTPS response status:',
          res.statusCode
        );
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          console.log(
            '[Antigravity] Port test HTTPS response body length:',
            body.length
          );
          if (res.statusCode === 200) {
            try {
              JSON.parse(body);
              console.log(
                '[Antigravity] Port test HTTPS SUCCESS for port:',
                port
              );
              resolve('https');
            } catch (error) {
              console.log(
                '[Antigravity] Port test HTTPS JSON parse failed:',
                error
              );
              this.testPortHttp(port, csrfToken, resolve, data);
            }
          } else {
            console.log(
              '[Antigravity] Port test HTTPS non-200 status:',
              res.statusCode
            );
            this.testPortHttp(port, csrfToken, resolve, data);
          }
        });
      });

      req.on('error', (error) => {
        console.log('[Antigravity] Port test HTTPS error:', error.message);
        this.testPortHttp(port, csrfToken, resolve, data);
      });
      req.on('timeout', () => {
        console.log('[Antigravity] Port test HTTPS timeout for port:', port);
        req.destroy();
        this.testPortHttp(port, csrfToken, resolve, data);
      });

      req.write(data);
      req.end();
    });
  }

  private testPortHttp(
    port: number,
    csrfToken: string,
    resolve: (value: 'http' | 'https' | null) => void,
    data: string
  ): void {
    console.log('[Antigravity] Trying HTTP fallback for port:', port);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(data)),
      'Connect-Protocol-Version': '1',
    };

    if (csrfToken) {
      headers['X-Codeium-Csrf-Token'] = csrfToken;
    }

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
      method: 'POST',
      headers,
      timeout: 3000,
    };

    const req = http.request(options, (res) => {
      console.log(
        '[Antigravity] Port test HTTP response status:',
        res.statusCode
      );
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        console.log(
          '[Antigravity] Port test HTTP response body length:',
          body.length
        );
        if (res.statusCode === 200) {
          try {
            JSON.parse(body);
            console.log('[Antigravity] Port test HTTP SUCCESS for port:', port);
            resolve('http');
          } catch (error) {
            console.log(
              '[Antigravity] Port test HTTP JSON parse failed:',
              error
            );
            resolve(null);
          }
        } else {
          console.log(
            '[Antigravity] Port test HTTP non-200 status:',
            res.statusCode
          );
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.log('[Antigravity] Port test HTTP error:', error.message);
      resolve(null);
    });
    req.on('timeout', () => {
      console.log('[Antigravity] Port test HTTP timeout for port:', port);
      req.destroy();
      resolve(null);
    });

    req.write(data);
    req.end();
  }

  private fetchUserStatus(): Promise<AntigravityUserStatus> {
    return new Promise((resolve, reject) => {
      if (!this.processInfo) {
        reject(new Error('Not connected'));
        return;
      }

      const data = JSON.stringify({
        metadata: {
          ideName: 'antigravity',
          extensionName: 'antigravity',
          locale: 'en',
        },
      });

      const protocolModule =
        this.processInfo.protocol === 'http' ? http : https;
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(data)),
        'Connect-Protocol-Version': '1',
        'X-Codeium-Csrf-Token': this.processInfo.csrfToken,
      };

      const options: https.RequestOptions | http.RequestOptions = {
        hostname: '127.0.0.1',
        port: this.processInfo.port,
        path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
        method: 'POST',
        headers,
        timeout: 5000,
      };

      if (this.processInfo.protocol === 'https') {
        (options as https.RequestOptions).rejectUnauthorized = false;
      }

      const req = protocolModule.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          console.log('[Antigravity] Raw API response body:', body);
          try {
            const parsed = JSON.parse(body) as AntigravityUserStatus;
            console.log(
              '[Antigravity] Parsed API response:',
              JSON.stringify(parsed, null, 2)
            );
            resolve(parsed);
          } catch (error) {
            console.log('[Antigravity] JSON parse error:', error);
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(data);
      req.end();
    });
  }

  private parseStatus(data: AntigravityUserStatus): UsageDetail[] {
    console.log(
      '[Antigravity] Raw API response:',
      JSON.stringify(data, null, 2)
    );

    const models =
      data.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];

    console.log('[Antigravity] Total models found:', models.length);
    console.log('[Antigravity] All models:', JSON.stringify(models, null, 2));

    const filteredModels = models.filter((m) => m.quotaInfo);
    console.log('[Antigravity] Models with quotaInfo:', filteredModels.length);

    const modelsWithPool: Array<{
      label: string;
      percentage: number;
      poolId: string;
      resetTime?: string;
      displayReset?: string;
      timeRemainingMinutes?: number;
    }> = [];

    filteredModels.forEach((m, index) => {
      const label = m.label || 'Unknown Model';
      const remainingFraction = m.quotaInfo?.remainingFraction ?? 1;
      const percentage = Math.round((1 - remainingFraction) * 100);
      const poolId = this.inferPoolId(label);

      console.log(`[Antigravity] Model ${index + 1}:`, {
        label,
        remainingFraction,
        percentage,
        poolId,
        quotaInfo: m.quotaInfo,
      });

      let displayReset: string | undefined;
      let timeRemainingMinutes: number | undefined;
      let resetTime: string | undefined;

      if (m.quotaInfo?.resetTime) {
        resetTime = m.quotaInfo.resetTime;
        const resetDate = new Date(m.quotaInfo.resetTime);
        if (!isNaN(resetDate.getTime()) && resetDate.getTime() > Date.now()) {
          const diff = resetDate.getTime() - Date.now();
          const totalMinutes = Math.round(diff / (1000 * 60));
          timeRemainingMinutes = totalMinutes;
          displayReset = this.formatTime(totalMinutes);
        }
      }

      modelsWithPool.push({
        label,
        percentage,
        poolId,
        displayReset,
        timeRemainingMinutes,
        resetTime,
      });
    });

    const poolMap = new Map<string, typeof modelsWithPool>();

    for (const model of modelsWithPool) {
      const existing = poolMap.get(model.poolId);
      if (!existing) {
        poolMap.set(model.poolId, [model]);
      } else {
        existing.push(model);
      }
    }

    console.log('[Antigravity] Pools found:', poolMap.size);

    const results: UsageDetail[] = [];

    for (const [poolId, poolModels] of poolMap.entries()) {
      const maxPercentage = Math.max(...poolModels.map((m) => m.percentage), 0);

      let earliestResetTime: string | undefined;
      let shortestTimeRemaining: number | undefined;
      let shortestDisplayReset: string | undefined;

      for (const model of poolModels) {
        if (model.resetTime) {
          if (
            !earliestResetTime ||
            new Date(model.resetTime) < new Date(earliestResetTime)
          ) {
            earliestResetTime = model.resetTime;
            shortestTimeRemaining = model.timeRemainingMinutes;
            shortestDisplayReset = model.displayReset;
          }
        }
      }

      const poolLabel = poolModels[0].label;

      const result: UsageDetail = {
        label: poolLabel,
        percentage: maxPercentage,
        limit: '',
        used: '',
        displayReset: shortestDisplayReset || 'Unavailable',
        timeRemainingMinutes: shortestTimeRemaining,
        resetTime: earliestResetTime,
      };

      console.log(`[Antigravity] Pool ${poolId}:`, {
        modelCount: poolModels.length,
        maxPercentage,
        resetTime: earliestResetTime,
        displayReset: shortestDisplayReset,
      });

      results.push(result);
    }

    results.sort((a, b) => b.percentage - a.percentage);

    console.log('[Antigravity] Final results count:', results.length);
    return results;
  }

  private formatTime(totalMinutes: number): string {
    const roundedMinutes = Math.round(totalMinutes);
    if (roundedMinutes <= 0) return 'Resetting soon';

    if (roundedMinutes >= 1440) {
      const d = Math.floor(roundedMinutes / 1440);
      const h = Math.floor((roundedMinutes % 1440) / 60);
      return `${d}d ${h}h`;
    }

    const h = Math.floor(roundedMinutes / 60);
    const m = roundedMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
}
