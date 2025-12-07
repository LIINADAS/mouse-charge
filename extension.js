import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

let selectedDevice = 'battery_hidpp_battery_0'; // Устройство по умолчанию


function getConfigPath() {
    const homeDir = GLib.get_home_dir();
    return GLib.build_filenamev([homeDir, '.local/share/gnome-shell/extensions/mouse-charge@github.com/device.config']);
}

function loadDeviceFromConfig() {
    try {
        const file = Gio.File.new_for_path(getConfigPath());
        const [success, contents] = file.load_contents(null);
        if (success) {
            const text = new TextDecoder().decode(contents);
            const match = text.match(/default=(.+)/);
            if (match && match[1].trim()) {
                selectedDevice = match[1].trim();
            }
        }
    } catch (e) {
        logError(e);
    }
}

function saveDeviceToConfig() {
    try {
        const file = Gio.File.new_for_path(getConfigPath());
        const content = `default=${selectedDevice}`;
        file.replace_contents(content, null, false, Gio.FileCreateFlags.NONE, null);
    } catch (e) {
        logError(e);
    }
}


const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Mouse Battery'));



        // Загружаем сохраненное устройство
        loadDeviceFromConfig();

        // Контейнер для иконки и текста
        const box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        
        // Иконка мыши
        this._icon = new St.Icon({
            icon_name: 'input-mouse',
            style_class: 'system-status-icon',
        });
        box.add_child(this._icon);

        // Текст с зарядом
        this._label = new St.Label({ text: '...', style: 'padding: 6px 0px; ' });
        box.add_child(this._label);

        this.add_child(box);

        // Раздел "Выбрать устройство"
        let deviceSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(deviceSection);

        // Кнопка для загрузки устройств
        let loadDevicesItem = new PopupMenu.PopupMenuItem(_('🔄 Load Devices'));

        loadDevicesItem.connect('activate', () => {
            this._loadDevices(deviceSection);
        });
        this.menu.addMenuItem(loadDevicesItem);

        // Разделитель
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Пункт меню для обновления
        let item = new PopupMenu.PopupMenuItem(_('Refresh Battery'));
        item.connect('activate', () => {
            this._updateBattery();
        });
        this.menu.addMenuItem(item);

        // Первое обновление
        this._updateBattery();
        
        // Периодическое обновление каждые 30 секунд
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
            this._updateBattery();
            return true;
        });
    }

    _loadDevices(section) {
        // Очищаем старые пункты
        section.removeAll();

        // Вызываем Python скрипт для получения списка устройств
        const proc = Gio.Subprocess.new(
            ['sh', '-c', "python3 ~/.local/share/gnome-shell/extensions/mouse-charge@github.com/checker_device.py"],
            Gio.SubprocessFlags.STDOUT_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, result) => {
            try {
                const [, stdout] = proc.communicate_utf8_finish(result);
                const devices = stdout.trim().split('\n');

                devices.forEach(device => {
                    if (device.trim()) {
                        let deviceItem = new PopupMenu.PopupMenuItem(device);
                        deviceItem.connect('activate', () => {
                            selectedDevice = device//.split('/').pop(); // Берём последнюю часть пути

                            saveDeviceToConfig(); // Сохраняем выбор в конфиг

                            this._updateBattery();
                        });
                        section.addMenuItem(deviceItem);
                    }
                });
            } catch (e) {
                logError(e);
            }
        });
    }

    _updateBattery() {
        // Вызываем Python скрипт через shell с выбранным устройством
        const proc = Gio.Subprocess.new(
            ['sh', '-c', `python3 ~/.local/share/gnome-shell/extensions/mouse-charge@github.com/charge_info.py ${selectedDevice}`],
            Gio.SubprocessFlags.STDOUT_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, result) => {
            try {
                const [, stdout] = proc.communicate_utf8_finish(result);
                const battery = stdout.trim();
                this._label.set_text(`${battery}%`);
            } catch (e) {
                this._label.set_text('Error');
                logError(e);
            }
        });
    }

    destroy() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
        }
        super.destroy();
    }
});

export default class IndicatorExampleExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
