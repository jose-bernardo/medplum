import pandas as pd
import matplotlib.pyplot as plt

# Function to parse sar -u (CPU usage) data
def parse_cpu_usage(file):
    data = []
    with open(file, 'r') as f:
        for line in f:
            if "CPU" in line or "Average" in line:  # Skip header lines
                continue
            parts = line.split()
            if len(parts) == 8:  # Typical sar -u output has 8 columns
                time = parts[0]
                user = float(parts[2])
                nice = float(parts[3])
                system = float(parts[4])
                idle = float(parts[7])
                total_cpu_usage = 100 - idle  # Total CPU usage is 100 - idle
                data.append((time, total_cpu_usage))
    return pd.DataFrame(data, columns=["Time", "CPU_Usage"])

# Function to parse sar -r (RAM usage) data
def parse_ram_usage(file):
    data = []
    with open(file, 'r') as f:
        for line in f:
            if "kbmemfree" in line or "Average" in line:  # Skip header lines
                continue
            parts = line.split()
            if len(parts) == 8:  # Typical sar -r output has 8 columns
                time = parts[0]
                memused_percent = float(parts[3])  # Memory usage in percentage
                data.append((time, memused_percent))
    return pd.DataFrame(data, columns=["Time", "RAM_Usage"])

# Parse the CPU and RAM logs
cpu_data = parse_cpu_usage('cpu_usage.log')
ram_data = parse_ram_usage('ram_usage.log')

# Convert 'Time' to index for plotting (optional: might want to adjust for readability)
cpu_data['Time'] = pd.to_datetime(cpu_data['Time'], format='%I:%M:%S %p')
ram_data['Time'] = pd.to_datetime(ram_data['Time'], format='%I:%M:%S %p')

# Plot the data
plt.figure(figsize=(10, 6))

# Plot CPU usage
plt.subplot(2, 1, 1)
plt.plot(cpu_data['Time'], cpu_data['CPU_Usage'], color='r', label='CPU Usage (%)')
plt.title('CPU and RAM Usage During Load Test')
plt.ylabel('CPU Usage (%)')
plt.legend()

# Plot RAM usage
plt.subplot(2, 1, 2)
plt.plot(ram_data['Time'], ram_data['RAM_Usage'], color='b', label='RAM Usage (%)')
plt.xlabel('Time')
plt.ylabel('RAM Usage (%)')
plt.legend()

plt.tight_layout()
plt.show()

