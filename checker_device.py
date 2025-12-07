import subprocess

def check_devices_list():
    comand = subprocess.run(
        ['upower', '-e'],
        capture_output=True,
        text=True,
        check=True)
    
    devices_list = [i.split('/')[-1] for i in comand.stdout.split('\n')]
    devices_String = ''
    for i in devices_list[:-1]:
        devices_String = f'{devices_String}\n{i}'
    
    return(devices_String)


if __name__ == '__main__':    
    print(check_devices_list())