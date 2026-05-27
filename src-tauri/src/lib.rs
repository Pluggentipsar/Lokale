use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

mod voice;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial schema",
            sql: include_str!("../../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "curriculum index columns",
            sql: include_str!("../../migrations/0002_curriculum_index.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:lokale.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            voice::transcribe_audio,
            voice::synthesize_speech,
            voice::voice_availability,
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
