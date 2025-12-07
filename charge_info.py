import subprocess
import sys

if __name__ == '__main__':
    name_mouse = sys.argv[1] if len(sys.argv) > 1 else 'battery_hidpp_battery_0'

    comand = subprocess.run(
        ['upower', '-i', f'/org/freedesktop/UPower/devices/{name_mouse}'],
        capture_output=True,
        text=True,
        check=True)
    
    full_info = comand.stdout
    battery_full_info = full_info.split('\n')[12]
    battery_charge_info = battery_full_info.split()[1]
    
    print(battery_charge_info[:-1])