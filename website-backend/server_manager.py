import os
import sys
import subprocess
import time
import signal
import socket

def check_port_in_use(port):
    """Check if a port is in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def find_process_using_port(port):
    """Find the process ID using the specified port."""
    try:
        if sys.platform.startswith('win'):
            # Windows
            result = subprocess.check_output(f'netstat -ano | findstr :{port}', shell=True).decode()
            if result:
                lines = result.strip().split('\n')
                for line in lines:
                    if f':{port}' in line and 'LISTENING' in line:
                        parts = line.strip().split()
                        return int(parts[-1])
        else:
            # Linux/Mac
            result = subprocess.check_output(f'lsof -i :{port} -t', shell=True).decode()
            if result:
                return int(result.strip())
    except subprocess.CalledProcessError:
        pass
    return None

def kill_process(pid):
    """Kill a process by its PID."""
    try:
        if sys.platform.startswith('win'):
            subprocess.check_call(f'taskkill /F /PID {pid}', shell=True)
        else:
            os.kill(pid, signal.SIGTERM)
        print(f"Process with PID {pid} terminated successfully.")
        return True
    except (subprocess.CalledProcessError, ProcessLookupError):
        print(f"Failed to terminate process with PID {pid}.")
        return False

def free_port(port):
    """Free up a port by killing the process using it."""
    if not check_port_in_use(port):
        print(f"Port {port} is not in use.")
        return True
    
    pid = find_process_using_port(port)
    if pid:
        print(f"Found process with PID {pid} using port {port}.")
        return kill_process(pid)
    else:
        print(f"Could not find process using port {port}.")
        return False

def free_ports(ports):
    """Free up multiple ports."""
    results = {}
    for port in ports:
        results[port] = free_port(port)
    return results

if __name__ == "__main__":
    # Default ports to check
    ports_to_check = [8000, 8001, 8002, 8003]
    
    # Check command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--help" or sys.argv[1] == "-h":
            print("Usage: python server_manager.py [port1 port2 ...]")
            print("If no ports are specified, will check ports 8000, 8001, 8002, 8003")
            sys.exit(0)
        else:
            try:
                ports_to_check = [int(port) for port in sys.argv[1:]]
            except ValueError:
                print("Invalid port number. Ports must be integers.")
                sys.exit(1)
    
    print(f"Checking ports: {ports_to_check}")
    results = free_ports(ports_to_check)
    
    # Print summary
    print("\nSummary:")
    for port, success in results.items():
        status = "freed" if success else "could not be freed"
        print(f"Port {port}: {status}") 