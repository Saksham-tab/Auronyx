const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Optimized DirectLLMClient
 * - Directly calls Python llm_client.py without FastAPI
 * - Uses subprocess to execute Python functions
 * - Provides .chat() and .health() methods
 */
class DirectLLMClient {
  constructor() {
    this.pythonDir = path.join(__dirname, '../models/ai');
    
    // Optimized Python executable detection
    const venvPython = path.join(process.cwd(), '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
    this.tryPythonExecutables = [venvPython, 'python', 'py', 'python3'];
  }

  async executePythonFunction(functionName, args = {}) {
    return new Promise((resolve, reject) => {
      let lastErr = null;
      
      const tryExecute = async (pythonExe) => {
        return new Promise((resolveExec, rejectExec) => {
          // Optimized Python script with better error handling
          const pythonScript = `
import sys
import json
import warnings
import io
from contextlib import redirect_stderr, redirect_stdout

warnings.filterwarnings('ignore')
sys.path.append(r'${this.pythonDir.replace(/\\/g, '\\\\')}')

try:
    from llm_client import ${functionName}
    args = ${JSON.stringify(args).replace(/null/g, 'None')}
    result = ${functionName}(**args)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

          const child = spawn(pythonExe, ['-c', pythonScript], {
            cwd: this.pythonDir,
            env: process.env,
            stdio: 'pipe'
          });

          let stdout = '';
          let stderr = '';

          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', (code) => {
            if (code === 0) {
              try {
                // Find the last line that looks like JSON
                const lines = stdout.trim().split('\n');
                let jsonLine = '';
                for (let i = lines.length - 1; i >= 0; i--) {
                  const line = lines[i].trim();
                  if (line.startsWith('{') || line.startsWith('[')) {
                    jsonLine = line;
                    break;
                  }
                }
                
                if (!jsonLine) {
                  rejectExec(new Error('No valid JSON found in Python output'));
                  return;
                }
                
                const result = JSON.parse(jsonLine);
                if (result.error) {
                  rejectExec(new Error(result.error));
                } else {
                  resolveExec(result);
                }
              } catch (parseErr) {
                rejectExec(new Error(`Failed to parse Python output: ${parseErr.message}`));
              }
            } else {
              rejectExec(new Error(`Python process exited with code ${code}: ${stderr}`));
            }
          });

          child.on('error', (err) => {
            rejectExec(err);
          });
        });
      };

      // Try each Python executable
      const tryAllExecutables = async () => {
        for (const exe of this.tryPythonExecutables) {
          try {
            const result = await tryExecute(exe);
            resolve(result);
            return;
          } catch (err) {
            lastErr = err;
            logger.warn(`Failed to execute with '${exe}': ${err.message}`);
          }
        }
        reject(lastErr || new Error('Failed to execute Python script with any available interpreter'));
      };

      tryAllExecutables();
    });
  }

  async chat({ message, context, location }) {
    try {
      const result = await this.executePythonFunction('chat_with_model', {
        message,
        context,
        location
      });
      
      logger.info('Direct LLM chat successful');
      return result;
    } catch (error) {
      logger.error('Direct LLM chat failed:', error.message);
      throw error;
    }
  }

  async health() {
    try {
      const result = await this.executePythonFunction('health_check', {});
      logger.info('Direct LLM health check successful');
      return result;
    } catch (error) {
      logger.error('Direct LLM health check failed:', error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const health = await this.health();
      logger.info('Direct LLM connection test successful:', health);
      return { success: true, data: health };
    } catch (error) {
      logger.error('Direct LLM connection test failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = DirectLLMClient;