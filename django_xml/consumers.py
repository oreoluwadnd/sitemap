import json
from channels.generic.websocket import AsyncWebsocketConsumer

class TaskProgressConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get the task_id from the URL
        self.task_id = self.scope['url_route']['kwargs'].get('task_id')
        print(self.task_id)
        if not self.task_id:
            await self.close()  # Close connection if no task_id is provided
            return

        # Add connection to group
        await self.channel_layer.group_add(f"task_{self.task_id}", self.channel_name)
        await self.accept()
        

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(f"task_{self.task_id}", self.channel_name)

    async def receive(self, text_data):
        # Handle messages received from the client
        # data = json.loads(text_data)
        # message = data.get('message')
        print(f"Received message from client: {text_data}")
        # You can add more logic here to handle the message
        
    async def scraper_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))
