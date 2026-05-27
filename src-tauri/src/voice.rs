//! Röstintegration via externa binärer på PATH.
//!
//! Vi shellar ut till whisper.cpp (`whisper-cli`) för STT och piper för
//! TTS. Inga sidecars i bundlen — användaren installerar själv. Det
//! håller appen liten och låter användaren välja modellstorlek.
//!
//! Om binärerna saknas returnerar vi ett strukturerat fel som frontend
//! visar som "voice ej tillgängligt" — appen i övrigt fortsätter funka.

use std::io::Write;
use std::path::PathBuf;
use std::process::Command;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::command;
use tempfile::NamedTempFile;

#[derive(Debug, Serialize)]
pub struct VoiceError {
    pub kind: String,
    pub message: String,
}

impl VoiceError {
    fn missing_binary(name: &str) -> Self {
        Self {
            kind: "missing_binary".into(),
            message: format!("Binären '{}' hittades inte på PATH.", name),
        }
    }

    fn from_io(e: std::io::Error) -> Self {
        Self {
            kind: "io".into(),
            message: e.to_string(),
        }
    }
}

fn which(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for p in std::env::split_paths(&path) {
        let candidate = p.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
        #[cfg(windows)]
        {
            let with_ext = p.join(format!("{name}.exe"));
            if with_ext.is_file() {
                return Some(with_ext);
            }
        }
    }
    None
}

#[derive(Debug, Deserialize)]
pub struct TranscribeArgs {
    /// Base64-kodade audio-bytes (WAV förväntas, 16kHz mono ger bäst resultat).
    pub audio_base64: String,
    /// Språkkod, t.ex. "es" eller "auto".
    pub language: String,
    /// Whisper-modellfil (.bin/.gguf), absolut path. Användaren konfigurerar.
    pub model_path: String,
}

#[derive(Debug, Serialize)]
pub struct TranscribeResult {
    pub text: String,
}

#[command]
pub fn transcribe_audio(args: TranscribeArgs) -> Result<TranscribeResult, VoiceError> {
    let bin = which("whisper-cli")
        .or_else(|| which("whisper.cpp"))
        .ok_or_else(|| VoiceError::missing_binary("whisper-cli"))?;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&args.audio_base64)
        .map_err(|e| VoiceError {
            kind: "decode".into(),
            message: format!("Base64-avkodning misslyckades: {e}"),
        })?;

    let mut tmp = NamedTempFile::new().map_err(VoiceError::from_io)?;
    tmp.write_all(&bytes).map_err(VoiceError::from_io)?;
    let wav_path = tmp.path().to_owned();

    let output = Command::new(&bin)
        .arg("-m")
        .arg(&args.model_path)
        .arg("-l")
        .arg(&args.language)
        .arg("-f")
        .arg(&wav_path)
        .arg("-nt") // ingen tidsstämpel
        .arg("--no-prints")
        .output()
        .map_err(|e| VoiceError {
            kind: "spawn".into(),
            message: format!("whisper-cli kunde inte startas: {e}"),
        })?;

    if !output.status.success() {
        return Err(VoiceError {
            kind: "exit".into(),
            message: format!(
                "whisper-cli exit {}: {}",
                output.status.code().unwrap_or(-1),
                String::from_utf8_lossy(&output.stderr)
            ),
        });
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(TranscribeResult { text })
}

#[derive(Debug, Deserialize)]
pub struct SynthesizeArgs {
    pub text: String,
    /// Piper-röstmodell (.onnx). Användaren konfigurerar.
    pub voice_path: String,
}

#[derive(Debug, Serialize)]
pub struct SynthesizeResult {
    /// WAV-bytes som base64.
    pub audio_base64: String,
}

#[command]
pub fn synthesize_speech(args: SynthesizeArgs) -> Result<SynthesizeResult, VoiceError> {
    let bin = which("piper").ok_or_else(|| VoiceError::missing_binary("piper"))?;

    let out = NamedTempFile::new().map_err(VoiceError::from_io)?;
    let out_path = out.path().to_owned();
    // Piper läser text från stdin och skriver wav till fil med --output_file
    let mut child = Command::new(&bin)
        .arg("--model")
        .arg(&args.voice_path)
        .arg("--output_file")
        .arg(&out_path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| VoiceError {
            kind: "spawn".into(),
            message: format!("piper kunde inte startas: {e}"),
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(args.text.as_bytes())
            .map_err(VoiceError::from_io)?;
    }

    let status = child.wait().map_err(VoiceError::from_io)?;
    if !status.success() {
        return Err(VoiceError {
            kind: "exit".into(),
            message: format!("piper exit {}", status.code().unwrap_or(-1)),
        });
    }

    let bytes = std::fs::read(&out_path).map_err(VoiceError::from_io)?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(SynthesizeResult { audio_base64: b64 })
}

#[derive(Debug, Serialize)]
pub struct VoiceAvailability {
    pub whisper: bool,
    pub piper: bool,
}

#[command]
pub fn voice_availability() -> VoiceAvailability {
    VoiceAvailability {
        whisper: which("whisper-cli").is_some() || which("whisper.cpp").is_some(),
        piper: which("piper").is_some(),
    }
}
