import GroupsList from './GroupsList';
import RecentActivity from './RecentActivity';

function Dashboard({ onSelectGroup, searchTerm, onNewGroup, onAddFriend }) {
  return (
    <div className="dashboard-layout">
      <div className="dashboard-layout__main">
        <GroupsList
          onSelectGroup={onSelectGroup}
          searchTerm={searchTerm}
          onNewGroup={onNewGroup}
          onAddFriend={onAddFriend}
        />
      </div>
      <div className="dashboard-layout__sidebar">
        <RecentActivity />
      </div>
    </div>
  );
}
export default Dashboard;