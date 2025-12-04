# Hand-Tracked 3D Object Picker

A real-time interactive 3D experience where you can pick up and interact with objects using your hands via a webcam. Built with Three.js and MediaPipe.

## Features

-   **Hand Tracking**: Real-time hand detection and tracking using MediaPipe.
-   **3D Physics**: Interactive objects with physics-based movement (gravity, friction, collisions).
-   **Gesture Control**: Pinch your thumb and index finger to grab and throw objects.
-   **Visual Feedback**: Dynamic lighting and visual cues for hand states (hover, grab).

## Getting Started

### Prerequisites

You need a modern web browser with webcam support.

### Running Locally

1.  Clone the repository:
    ```bash
    git clone https://github.com/rnnh-code/object-pick-with-hands.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd object-pick-with-hands
    ```
3.  Start a local server (e.g., using Python):
    ```bash
    python3 -m http.server 8000
    ```
4.  Open your browser and go to `http://localhost:8000`.

## Technologies

-   **Three.js**: For 3D rendering and scene management.
-   **MediaPipe Hands**: For robust hand tracking and landmark detection.
-   **Vanilla JavaScript**: Core logic and interaction handling.
-   **CSS3**: Styling and UI overlays.

## Controls

-   **Show Hands**: Bring your hands into the camera view.
-   **Grab**: Pinch your thumb and index finger together near an object.
-   **Move**: Move your hand while pinching to drag the object.
-   **Throw**: Release the pinch while moving to throw the object.
