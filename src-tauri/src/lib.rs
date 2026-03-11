use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut};

struct AudioState {
    handle: OutputStreamHandle,
    sink: Mutex<Option<Sink>>,
    custom_path: Mutex<Option<String>>,
}

fn internal_play_sound(app_handle: &AppHandle, key: &str) -> Result<(), String> {
    println!("DEBUG: internal_play_sound called with key: {}", key);
    
    let audio_state = app_handle.state::<AudioState>();
    
    // Try to find the file in multiple possible locations
    let mut resource_path = PathBuf::new();
    
    // 0. Priority: Custom Path from user settings
    if let Some(path_str) = audio_state.custom_path.lock().unwrap().clone() {
        let base_exts = ["mp3", "wav", "MP3", "WAV"];
        for ext in base_exts {
            let p = PathBuf::from(&path_str).join(format!("{}.{}", key, ext));
            if p.exists() {
                println!("DEBUG: Found file in custom path: {:?}", p);
                resource_path = p;
                break;
            }
        }
    }

    // 1. First, try development path (relative to project root or src-tauri)
    if !resource_path.exists() && cfg!(debug_assertions) {
        if let Ok(cwd) = std::env::current_dir() {
            // Try relative to workspace root (parent of src-tauri)
            let parent = cwd.parent().unwrap_or(&cwd);
            let paths_to_try = [
                cwd.join("public").join("voices").join(format!("{}.mp3", key)),
                parent.join("public").join("voices").join(format!("{}.mp3", key)),
                cwd.join("voices").join(format!("{}.mp3", key)),
            ];

            for path in paths_to_try {
                if path.exists() {
                    println!("DEBUG: Found file in dev path: {:?}", path);
                    resource_path = path;
                    break;
                }
            }
        }
    }

    // 2. If not found in dev path, use Tauri's official Resource resolve (for production)
    if !resource_path.exists() {
        let try_paths = [
            format!("voices/{}.mp3", key),
            format!("voices/{}.MP3", key),
            format!("public/voices/{}.mp3", key),
            format!("_up_/public/voices/{}.mp3", key),
            format!("{}.mp3", key),
        ];

        for p in try_paths {
            if let Ok(path) = app_handle.path().resolve(&p, BaseDirectory::Resource) {
                if path.exists() {
                    resource_path = path;
                    break;
                }
            }
        }
        
        // Brute-force fallback directly traversing the resource directory
        if !resource_path.exists() {
            if let Ok(res_dir) = app_handle.path().resource_dir() {
                let direct_paths = [
                    res_dir.join("voices").join(format!("{}.mp3", key)),
                    res_dir.join("public").join("voices").join(format!("{}.mp3", key)),
                    res_dir.join("_up_").join("public").join("voices").join(format!("{}.mp3", key)),
                ];
                for path in direct_paths {
                    if path.exists() {
                        resource_path = path;
                        break;
                    }
                }
            }
        }
    }

    if !resource_path.exists() {
        println!("DEBUG: Sound file not found for key {}: {:?}", key, resource_path);
        return Err(format!("Sound file not found for key {}: {:?}", key, resource_path));
    }

    let file_metadata = std::fs::metadata(&resource_path).map_err(|e| e.to_string())?;
    if file_metadata.len() == 0 {
        return Err(format!("Sound file is empty: {:?}", resource_path));
    }

    println!("Playing sound for key: {} at {:?}", key, resource_path);

    // Emit event to frontend for visual feedback
    let _ = app_handle.emit("key-pressed", key);

    // Decode and play sound exclusively
    let file = BufReader::new(File::open(resource_path).expect("Failed to open file"));
    let source = Decoder::new(file).map_err(|e| e.to_string())?;
    
    let mut sink_lock = audio_state.sink.lock().unwrap();
    
    // 1. Stop and drop the old sink if it exists
    if let Some(old_sink) = sink_lock.take() {
        old_sink.stop();
    }
    
    // 2. Create a fresh sink for the new sound
    let new_sink = Sink::try_new(&audio_state.handle).map_err(|e| e.to_string())?;
    new_sink.append(source);
    
    // 3. Store it back in the state
    *sink_lock = Some(new_sink);
    
    Ok(())
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn play_sound(app_handle: AppHandle, key: String) -> Result<(), String> {
    println!("DEBUG: play_sound command received: {}", key);
    internal_play_sound(&app_handle, &key)
}

#[tauri::command]
fn set_custom_path(state: State<'_, AudioState>, path: Option<String>) {
    println!("DEBUG: Setting custom path to: {:?}", path);
    let mut custom_path = state.custom_path.lock().unwrap();
    *custom_path = path;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (stream, handle) = OutputStream::try_default().expect("Failed to open audio output stream");
    std::mem::forget(stream);

    let audio_state = AudioState {
        handle,
        sink: Mutex::new(None),
        custom_path: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(audio_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, _event| {
                let id_str = shortcut.id().to_string();
                println!("Global shortcut triggered: {}", id_str);
                
                // Matches "Digit0", "Digit1", etc. or custom IDs
                if id_str.starts_with("Digit") {
                   let digit = &id_str[5..];
                   let _ = internal_play_sound(app, digit);
                }
            })
            .build()
        )
        .setup(|app| {
            // Register shortcuts for 0-9
            let codes = [
                Code::Digit0, Code::Digit1, Code::Digit2, Code::Digit3, Code::Digit4,
                Code::Digit5, Code::Digit6, Code::Digit7, Code::Digit8, Code::Digit9,
            ];
            for code in codes {
                let shortcut = Shortcut::new(None, code);
                app.global_shortcut().register(shortcut).expect("failed to register shortcut");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, play_sound, set_custom_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
