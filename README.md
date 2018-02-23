# MTGA Tracker
Collection of tools built up around the MTGA Client logs

### Backend

The back end is at it's core a python log parser project. There's a flask app tacked on top to communicate state with
the frontend.

### Front end

The front end of MTGA Tracker is an electron app that uses node / http to communicate with the backend
